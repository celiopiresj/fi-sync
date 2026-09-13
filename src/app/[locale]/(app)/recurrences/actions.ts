"use server";

import { addDays, addMonths, addWeeks } from "date-fns";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import {
  parseCalendarDate,
  todayCalendarDate,
  toAppZoned,
  fromAppZoned,
} from "@/lib/date";
import { resolveInvoiceForDate } from "@/lib/invoice-resolution";
import {
  debitRecurrenceContentSchema,
  debitRecurrenceCreateSchema,
  refineDebitRecurrence,
  creditRecurrenceContentSchema,
  creditRecurrenceCreateSchema,
  refineCreditRecurrence,
  type DebitRecurrenceContentFormValues,
  type DebitRecurrenceCreateFormValues,
  type CreditRecurrenceContentFormValues,
  type CreditRecurrenceCreateFormValues,
  type RecurrenceFrequencyValue,
  type PaymentMethodOption,
} from "./_schema/schema";

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// A new recurrence always defaults to the self ("Eu") Person — same
// simplification (and duplicated for the same _schema/actions-per-route
// reasoning) as transactions/actions.ts's own computeDefaultPersonId,
// since every user has exactly one, created at sign-up and permanent.
async function computeDefaultPersonId(userId: string) {
  const self = await prisma.person.findFirst({
    where: { userId, isSelf: true },
    select: { id: true },
  });
  return self?.id ?? null;
}

// Generates at most this many months of occurrences at a time — enough
// for a rule to feel "fully scheduled" without ever materializing
// hundreds of Transaction rows up front for an indefinite recurrence
// (see the Recurrence doc comment in prisma/schema.prisma). Both
// create*Recurrence and extendRecurrenceGeneration cap their generation
// loop at `today + GENERATION_WINDOW_MONTHS` (or the rule's own endDate,
// whichever comes first).
const GENERATION_WINDOW_MONTHS = 12;
// How much generated runway (today → the last already-generated
// occurrence) is left before listRecurrences flags a recurrence as
// needsExtension, prompting the user to generate another window.
const LOW_RUNWAY_MONTHS = 1;

export type RecurrenceFilters = {
  accountId?: string;
  categoryId?: string;
  search?: string;
  type?: "all" | "income" | "expenses";
  // Defaults to "active" wherever omitted (listRecurrences below) — see
  // the "User Review Required" note in tasks/012.md: the initial list
  // shows active recurrences by default, with inactive/finished
  // available as an explicit filter choice, never the default.
  status?: "active" | "finished" | "all";
};

// A recurrence counts as "active" when it still has at least one linked
// occurrence dated today or later — deliberately NOT derived from
// `endDate` alone, since only recurrences created through THIS screen
// populate that column (see create*Recurrence below); deriving from the
// actual linked transactions instead means legacy recurrences (created
// via the transaction form's own "Recorrência" field, tasks/006, before
// this screen existed) still filter/display correctly with no backfill
// needed. A recurrence with zero occurrences left in the future is
// "finished" — it isn't deleted on its own (deleting is still a
// separate, explicit action), it just naturally stops showing up in the
// default "active" view once its last occurrence passes.
export async function listRecurrences(filters: RecurrenceFilters = {}) {
  const userId = await requireUserId();
  const todayDate = parseCalendarDate(todayCalendarDate());
  const lowRunwayThreshold = fromAppZoned(
    addMonths(toAppZoned(todayDate), LOW_RUNWAY_MONTHS),
  );
  const status = filters.status ?? "active";

  const recurrences = await prisma.recurrence.findMany({
    where: {
      userId,
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.search
        ? { description: { contains: filters.search, mode: "insensitive" } }
        : {}),
      ...(filters.type === "income" ? { amount: { gt: 0 } } : {}),
      ...(filters.type === "expenses" ? { amount: { lt: 0 } } : {}),
      ...(status === "active"
        ? { transactions: { some: { date: { gte: todayDate } } } }
        : status === "finished"
          ? { transactions: { none: { date: { gte: todayDate } } } }
          : {}),
    },
    include: {
      account: { select: { id: true, name: true, type: true } },
      category: { select: { id: true, name: true, icon: true, colorStyle: true } },
      card: { select: { id: true, name: true, lastFourDigits: true } },
      splits: { include: { person: { select: { id: true, name: true } } } },
      // Latest linked occurrence, if any — one row per recurrence in a
      // single query (Prisma's relation `take` inside `include`) rather
      // than a separate groupBy round-trip. Drives needsExtension below.
      transactions: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
      // Filtered relation count (Prisma 5+) — reused for the `isActive`
      // flag below so a "todas" listing can still tell them apart, using
      // the exact same definition of "active" the filter above uses.
      _count: {
        select: { transactions: { where: { date: { gte: todayDate } } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Which recurrences have a still-PENDING occurrence to "adiantar"
  // (advanceRecurrenceOccurrence below) — a separate batched query
  // rather than a second `include.transactions` on the relation above
  // (Prisma doesn't support two differently-filtered includes of the
  // same relation in one query): this one is ordered ascending, so the
  // FIRST row seen per recurrenceId is its own soonest-due pending
  // occurrence, exactly what the button needs to know exists.
  const soonestPendingByRecurrenceId = new Map<string, Date>();
  if (recurrences.length > 0) {
    const pendingOccurrences = await prisma.transaction.findMany({
      where: {
        recurrenceId: { in: recurrences.map((recurrence) => recurrence.id) },
        status: "PENDING",
      },
      orderBy: { date: "asc" },
      select: { recurrenceId: true, date: true },
    });
    for (const occurrence of pendingOccurrences) {
      if (!occurrence.recurrenceId) continue;
      if (!soonestPendingByRecurrenceId.has(occurrence.recurrenceId)) {
        soonestPendingByRecurrenceId.set(occurrence.recurrenceId, occurrence.date);
      }
    }
  }

  return recurrences.map((recurrence) => {
    const lastGeneratedDate = recurrence.transactions[0]?.date ?? null;
    // Already generated all the way through its own endDate — nothing
    // left to extend, regardless of runway (a rule like this is also
    // "finished"/inactive already, per isActive above, once that last
    // occurrence itself passes).
    const hasReachedEnd =
      recurrence.endDate !== null &&
      lastGeneratedDate !== null &&
      lastGeneratedDate >= recurrence.endDate;
    // No occurrences generated at all (e.g. left paused after a previous
    // decline — see the "Fica pausada" decision — or never generated in
    // the first place) counts as needing extension too, same as thin
    // runway: both are "the user should be offered another window."
    const needsExtension =
      !hasReachedEnd &&
      (lastGeneratedDate === null || lastGeneratedDate < lowRunwayThreshold);

    return {
      id: recurrence.id,
      description: recurrence.description,
      amount: recurrence.amount.toNumber(),
      frequency: recurrence.frequency,
      startDate: recurrence.startDate,
      endDate: recurrence.endDate,
      accountId: recurrence.accountId,
      account: recurrence.account,
      categoryId: recurrence.categoryId,
      category: recurrence.category,
      cardId: recurrence.cardId,
      card: recurrence.card,
      paymentMethod: recurrence.paymentMethod,
      splits: recurrence.splits.map((split) => ({
        personId: split.personId,
        person: split.person,
        amount: split.amount.toNumber(),
      })),
      isActive: recurrence._count.transactions > 0,
      needsExtension,
      canAdvance: soonestPendingByRecurrenceId.has(recurrence.id),
    };
  });
}

// Data every instance of the create/edit sheets needs for their selects
// — one shared account list for both the debit and credit forms
// (tasks/015.md reunited transactions' own debit/credit forms the same
// way; this screen follows suit), with `cards` included so the credit
// form's own card picker doesn't need a separate fetch. Non-credit-card
// accounts simply have an empty `cards` array.
export async function getRecurrenceFormOptions() {
  const userId = await requireUserId();

  const [accounts, categories, people] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      include: { cards: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: { name: "asc" },
    }),
    prisma.person.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    }),
  ]);

  const defaultPersonId = await computeDefaultPersonId(userId);
  // Same split/reasoning as transactions/actions.ts's own
  // getTransactionFormOptions — one Account.isDefault flag, resolved
  // against whichever type each form's own picker actually accepts
  // (CREDIT_CARD/INVESTMENT/POCKET are all rejected by the debit forms
  // below, see their own account guards).
  const defaultDebitAccountId =
    accounts.find(
      (account) =>
        account.isDefault &&
        (account.type === "CHECKING" ||
          account.type === "SAVINGS" ||
          account.type === "CASH"),
    )?.id ?? null;
  const defaultCreditAccountId =
    accounts.find((account) => account.isDefault && account.type === "CREDIT_CARD")?.id ??
    null;

  return {
    accounts,
    categories,
    people,
    defaultPersonId,
    defaultDebitAccountId,
    defaultCreditAccountId,
  };
}

// Steps one occurrence date forward by `frequency`, pinned to
// APP_TIME_ZONE for the same reason transactions/actions.ts's own
// (private, differently-typed — lowercase form values vs this file's
// uppercase Prisma-enum values) stepDate helper is: date-fns math reads/
// writes the runtime's own timezone otherwise, which has nothing to do
// with where the user actually is. See lib/date.ts's file-level comment.
function stepOccurrenceDate(date: Date, frequency: RecurrenceFrequencyValue): Date {
  const zoned = toAppZoned(date);
  const stepped =
    frequency === "DAILY"
      ? addDays(zoned, 1)
      : frequency === "WEEKLY"
        ? addWeeks(zoned, 1)
        : addMonths(zoned, 1);
  return fromAppZoned(stepped);
}

// Shape createRecurrenceOccurrence/resolveSplitsCreateInput actually
// read from — shared by both the debit and credit paths below (a debit
// occurrence carries cardId: "" / paymentMethod: value; a credit one
// carries cardId: value / paymentMethod: ""), OR a synthetic object
// rebuilt from a stored Recurrence + its RecurrenceSplit rows
// (extendRecurrenceGeneration, which has no form submission to validate
// — it's re-generating from the rule's own template).
type OccurrenceContent = {
  accountId: string;
  categoryId: string;
  cardId: string;
  paymentMethod: PaymentMethodOption | "";
  description: string;
  type: "income" | "expense";
  personId: string;
  splits: { personId: string; amount: number }[];
};

// Reconciles the top-level `personId` field with the opt-in `splits`
// array into Prisma's `splits.create` input — same convention as
// transactions/actions.ts's own resolveSplitsCreateInput (duplicated,
// not imported — see the _schema/actions-per-route note on
// computeDefaultPersonId above), simplified because personId is
// mandatory here (both content schemas' `.min(1)`): unlike
// transactions, there's no "fully unattributed" case to fall through to,
// so this never returns null.
function resolveSplitsCreateInput(
  value: OccurrenceContent,
  amount: number,
): { personId: string; amount: number }[] {
  if (value.splits.length > 0) {
    return value.splits.map((split) => ({
      personId: split.personId,
      amount: value.type === "expense" ? -split.amount : split.amount,
    }));
  }
  return [{ personId: value.personId, amount }];
}

// Creates one generated Transaction row for a recurrence occurrence —
// content copied from the rule, splits copied from its RecurrenceSplit
// template, and (CREDIT_CARD accounts only) card/invoice links resolved
// from the occurrence's OWN date, not a carried-over cursor: each
// occurrence already has its own real date, unlike installments (see
// createTransactionRow's near-identical comment in
// transactions/actions.ts). Callers (create*Recurrence,
// extendRecurrenceGeneration) MUST await this one occurrence at a time,
// in a plain `for`/`while` loop — never Promise.all — see
// resolveInvoiceForDate's own doc comment in @/lib/invoice-resolution
// for why.
async function createRecurrenceOccurrence(params: {
  userId: string;
  value: OccurrenceContent;
  amount: number;
  date: Date;
  recurrenceId: string;
  account: {
    id: string;
    type: string;
    creditCardDetails: { closingDay: number; dueDay: number } | null;
  };
  todayDate: Date;
}) {
  const { userId, value, amount, date, recurrenceId, account, todayDate } = params;

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      accountId: value.accountId,
      categoryId: value.categoryId || undefined,
      paymentMethod: value.paymentMethod || undefined,
      description: value.description,
      amount,
      date,
      // Occurrences dated today or earlier are already "done"; later
      // ones haven't happened yet — same rule this screen's v1
      // predecessor used.
      status: date <= todayDate ? "COMPLETED" : "PENDING",
      recurrenceId,
      splits: { create: resolveSplitsCreateInput(value, amount) },
    },
  });

  const isCreditCard = account.type === "CREDIT_CARD" && account.creditCardDetails;
  if (isCreditCard && account.creditCardDetails) {
    const invoice = await resolveInvoiceForDate(
      account.id,
      date,
      account.creditCardDetails,
    );

    await prisma.transactionInvoice.create({
      data: { transactionId: transaction.id, invoiceId: invoice.id },
    });

    if (value.cardId) {
      await prisma.transactionCard.create({
        data: { transactionId: transaction.id, cardId: value.cardId },
      });
    }
  }

  return transaction;
}

function revalidateAll() {
  revalidatePath("/recurrences");
  revalidatePath("/transactions");
}

// ---------------------------------------------------------------------
// Debit / everyday recurrences
// ---------------------------------------------------------------------

// Creates the Recurrence rule (content + person/splits template) AND its
// first window of occurrence Transaction rows, up to
// GENERATION_WINDOW_MONTHS ahead (or the rule's own endDate, if it's
// sooner) — never the rule's full lifetime up front, so an indefinite
// recurrence never materializes hundreds of rows in one call (tasks/012:
// "sem data limite pra não gerar centenas, gere 12 meses"). Running low
// on generated runway is surfaced by listRecurrences' needsExtension
// flag, resolved by extendRecurrenceGeneration below.
export async function createDebitRecurrence(data: DebitRecurrenceCreateFormValues) {
  const userId = await requireUserId();
  const t = await getTranslations("scrn-recurrences");
  const tValidation = await getTranslations("common.validation");

  const schema = debitRecurrenceCreateSchema.superRefine((value, ctx) =>
    refineDebitRecurrence(value, ctx, {
      paymentMethodRequired: tValidation("required"),
      splitsMismatch: t("splits.mismatch"),
    }),
  );
  const result = schema.safeParse(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;

  const account = await prisma.account.findUnique({
    where: { id: value.accountId, userId },
  });
  // Same exclusion as the batch transaction endpoint's own
  // investmentAccountNotAllowed guard (transactions/actions.ts) —
  // investment/pocket accounts only ever move money through the
  // dedicated Investments screen's own aporte/resgate flow
  // (createInvestmentMovement), never a debit recurrence.
  if (
    !account ||
    account.type === "CREDIT_CARD" ||
    account.type === "INVESTMENT" ||
    account.type === "POCKET"
  ) {
    return { error: "Invalid account" };
  }

  const signedAmount = value.type === "expense" ? -value.amount : value.amount;
  const todayDate = parseCalendarDate(todayCalendarDate());
  const startDate = parseCalendarDate(value.startDate);
  const endDate = value.endDate ? parseCalendarDate(value.endDate) : null;
  const windowEnd = fromAppZoned(
    addMonths(toAppZoned(todayDate), GENERATION_WINDOW_MONTHS),
  );
  const generateUntil = endDate && endDate < windowEnd ? endDate : windowEnd;

  const occurrenceValue: OccurrenceContent = {
    accountId: value.accountId,
    categoryId: value.categoryId,
    cardId: "",
    paymentMethod: value.paymentMethod,
    description: value.description,
    type: value.type,
    personId: value.personId,
    splits: value.splits,
  };

  const recurrence = await prisma.recurrence.create({
    data: {
      userId,
      accountId: value.accountId,
      categoryId: value.categoryId || undefined,
      paymentMethod: value.paymentMethod || undefined,
      description: value.description,
      amount: signedAmount,
      frequency: value.frequency,
      startDate,
      endDate,
      splits: { create: resolveSplitsCreateInput(occurrenceValue, signedAmount) },
    },
  });

  let occurrenceDate = startDate;
  while (occurrenceDate <= generateUntil) {
    await createRecurrenceOccurrence({
      userId,
      value: occurrenceValue,
      amount: signedAmount,
      date: occurrenceDate,
      recurrenceId: recurrence.id,
      account: { ...account, creditCardDetails: null },
      todayDate,
    });
    occurrenceDate = stepOccurrenceDate(occurrenceDate, value.frequency);
  }

  revalidateAll();
  return { error: null };
}

// Content-only edit (description/amount/type/account/category/person+
// splits/endDate) — frequency/startDate remain immutable after creation,
// see debitRecurrenceCreateSchema's doc comment in _schema/schema.ts.
// Cascades to the rule's still-future, still-Pendente occurrences only:
// past or already-Concluída ones are left exactly as they were
// (tasks/012.md's Open Questions).
export async function updateDebitRecurrence(
  id: string,
  data: DebitRecurrenceContentFormValues,
) {
  const userId = await requireUserId();
  const t = await getTranslations("scrn-recurrences");
  const tValidation = await getTranslations("common.validation");

  const schema = debitRecurrenceContentSchema.superRefine((value, ctx) =>
    refineDebitRecurrence(value, ctx, {
      paymentMethodRequired: tValidation("required"),
      splitsMismatch: t("splits.mismatch"),
    }),
  );
  const result = schema.safeParse(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;

  const account = await prisma.account.findUnique({
    where: { id: value.accountId, userId },
  });
  // Same exclusion as the batch transaction endpoint's own
  // investmentAccountNotAllowed guard (transactions/actions.ts) —
  // investment/pocket accounts only ever move money through the
  // dedicated Investments screen's own aporte/resgate flow
  // (createInvestmentMovement), never a debit recurrence.
  if (
    !account ||
    account.type === "CREDIT_CARD" ||
    account.type === "INVESTMENT" ||
    account.type === "POCKET"
  ) {
    return { error: "Invalid account" };
  }

  const existing = await prisma.recurrence.findUnique({ where: { id, userId } });
  if (!existing) {
    return { error: "Not found" };
  }

  const signedAmount = value.type === "expense" ? -value.amount : value.amount;
  const todayDate = parseCalendarDate(todayCalendarDate());
  const endDate = value.endDate ? parseCalendarDate(value.endDate) : null;

  const occurrenceValue: OccurrenceContent = {
    accountId: value.accountId,
    categoryId: value.categoryId,
    cardId: "",
    paymentMethod: value.paymentMethod,
    description: value.description,
    type: value.type,
    personId: value.personId,
    splits: value.splits,
  };

  const content = {
    description: value.description,
    amount: signedAmount,
    accountId: value.accountId,
    categoryId: value.categoryId || null,
    cardId: null,
    paymentMethod: value.paymentMethod || null,
    endDate,
  };

  // Splits template: replace wholesale, same delete-then-nested-create
  // pattern updateTransaction itself uses for TransactionSplit — simpler
  // than diffing which person rows changed, and a recurrence's own
  // splits list is never long enough for that to matter.
  await prisma.recurrenceSplit.deleteMany({ where: { recurrenceId: id } });
  await prisma.recurrence.update({
    where: { id },
    data: {
      ...content,
      splits: { create: resolveSplitsCreateInput(occurrenceValue, signedAmount) },
    },
  });

  const updatedCount = await cascadeRecurrenceEdit({
    id,
    userId,
    todayDate,
    endDate,
    content: {
      description: content.description,
      amount: content.amount,
      accountId: content.accountId,
      categoryId: content.categoryId,
      paymentMethod: content.paymentMethod,
    },
    occurrenceValue,
    signedAmount,
  });

  revalidateAll();
  return { error: null, updatedCount };
}

// ---------------------------------------------------------------------
// Credit card recurrences
// ---------------------------------------------------------------------

export async function createCreditRecurrence(data: CreditRecurrenceCreateFormValues) {
  const userId = await requireUserId();
  const t = await getTranslations("scrn-recurrences");

  const schema = creditRecurrenceCreateSchema.superRefine((value, ctx) =>
    refineCreditRecurrence(value, ctx, {
      splitsMismatch: t("splits.mismatch"),
    }),
  );
  const result = schema.safeParse(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;

  const account = await prisma.account.findUnique({
    where: { id: value.accountId, userId },
    include: { creditCardDetails: true },
  });
  if (!account || account.type !== "CREDIT_CARD" || !account.creditCardDetails) {
    return { error: "Invalid account" };
  }

  const signedAmount = value.type === "expense" ? -value.amount : value.amount;
  const todayDate = parseCalendarDate(todayCalendarDate());
  const startDate = parseCalendarDate(value.startDate);
  const endDate = value.endDate ? parseCalendarDate(value.endDate) : null;
  const windowEnd = fromAppZoned(
    addMonths(toAppZoned(todayDate), GENERATION_WINDOW_MONTHS),
  );
  const generateUntil = endDate && endDate < windowEnd ? endDate : windowEnd;

  const occurrenceValue: OccurrenceContent = {
    accountId: value.accountId,
    categoryId: value.categoryId,
    cardId: value.cardId,
    paymentMethod: "",
    description: value.description,
    type: value.type,
    personId: value.personId,
    splits: value.splits,
  };

  const recurrence = await prisma.recurrence.create({
    data: {
      userId,
      accountId: value.accountId,
      categoryId: value.categoryId || undefined,
      cardId: value.cardId,
      description: value.description,
      amount: signedAmount,
      frequency: value.frequency,
      startDate,
      endDate,
      splits: { create: resolveSplitsCreateInput(occurrenceValue, signedAmount) },
    },
  });

  let occurrenceDate = startDate;
  while (occurrenceDate <= generateUntil) {
    await createRecurrenceOccurrence({
      userId,
      value: occurrenceValue,
      amount: signedAmount,
      date: occurrenceDate,
      recurrenceId: recurrence.id,
      account,
      todayDate,
    });
    occurrenceDate = stepOccurrenceDate(occurrenceDate, value.frequency);
  }

  revalidateAll();
  return { error: null };
}

export async function updateCreditRecurrence(
  id: string,
  data: CreditRecurrenceContentFormValues,
) {
  const userId = await requireUserId();
  const t = await getTranslations("scrn-recurrences");

  const schema = creditRecurrenceContentSchema.superRefine((value, ctx) =>
    refineCreditRecurrence(value, ctx, {
      splitsMismatch: t("splits.mismatch"),
    }),
  );
  const result = schema.safeParse(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;

  const account = await prisma.account.findUnique({
    where: { id: value.accountId, userId },
    include: { creditCardDetails: true },
  });
  if (!account || account.type !== "CREDIT_CARD" || !account.creditCardDetails) {
    return { error: "Invalid account" };
  }

  const existing = await prisma.recurrence.findUnique({ where: { id, userId } });
  if (!existing) {
    return { error: "Not found" };
  }

  const signedAmount = value.type === "expense" ? -value.amount : value.amount;
  const todayDate = parseCalendarDate(todayCalendarDate());
  const endDate = value.endDate ? parseCalendarDate(value.endDate) : null;

  const occurrenceValue: OccurrenceContent = {
    accountId: value.accountId,
    categoryId: value.categoryId,
    cardId: value.cardId,
    paymentMethod: "",
    description: value.description,
    type: value.type,
    personId: value.personId,
    splits: value.splits,
  };

  const content = {
    description: value.description,
    amount: signedAmount,
    accountId: value.accountId,
    categoryId: value.categoryId || null,
    cardId: value.cardId,
    paymentMethod: null,
    endDate,
  };

  await prisma.recurrenceSplit.deleteMany({ where: { recurrenceId: id } });
  await prisma.recurrence.update({
    where: { id },
    data: {
      ...content,
      splits: { create: resolveSplitsCreateInput(occurrenceValue, signedAmount) },
    },
  });

  const updatedCount = await cascadeRecurrenceEdit({
    id,
    userId,
    todayDate,
    endDate,
    content: {
      description: content.description,
      amount: content.amount,
      accountId: content.accountId,
      categoryId: content.categoryId,
      paymentMethod: null,
    },
    occurrenceValue,
    signedAmount,
  });

  revalidateAll();
  return { error: null, updatedCount };
}

// Shared cascade step for both updateDebitRecurrence and
// updateCreditRecurrence above — shortens future/PENDING occurrences past
// a newly-shortened endDate, then rewrites the remaining ones (content +
// splits) to match the just-saved template. Same v1 limitation
// updateTransaction documents for a single transaction: a card or
// account-type change here only takes effect for occurrences generated
// AFTER this edit (createRecurrenceOccurrence / extendRecurrenceGeneration),
// not ones already materialized — so this never touches TransactionCard/
// TransactionInvoice on the cascaded rows.
async function cascadeRecurrenceEdit(params: {
  id: string;
  userId: string;
  todayDate: Date;
  endDate: Date | null;
  content: {
    description: string;
    amount: number;
    accountId: string;
    categoryId: string | null;
    paymentMethod: PaymentMethodOption | null;
  };
  occurrenceValue: OccurrenceContent;
  signedAmount: number;
}) {
  const { id, userId, todayDate, endDate, content } = params;

  const cascadeWhere = {
    recurrenceId: id,
    userId,
    status: "PENDING" as const,
    date: { gte: todayDate },
  };

  // Shortening endDate deletes anything now past the new cutoff first —
  // mirrors deleteRecurrence's own future/PENDING cascade below, just
  // scoped to "beyond the new end" instead of "everything future." A
  // no-op when endDate is unset or was lengthened: nothing already
  // generated can be past a cutoff that's null or further out than
  // before.
  if (endDate) {
    await prisma.transaction.deleteMany({
      where: { ...cascadeWhere, date: { gt: endDate } },
    });
  }

  const cascadedRows = await prisma.transaction.findMany({
    where: cascadeWhere,
    select: { id: true },
  });
  const cascadedIds = cascadedRows.map((row) => row.id);

  await prisma.transaction.updateMany({
    where: { id: { in: cascadedIds } },
    data: {
      description: content.description,
      amount: content.amount,
      accountId: content.accountId,
      categoryId: content.categoryId,
      paymentMethod: content.paymentMethod,
    },
  });

  // Splits cascade the same way the rule's own template does above:
  // delete and recreate from the just-saved template, rather than diff.
  await prisma.transactionSplit.deleteMany({
    where: { transactionId: { in: cascadedIds } },
  });
  if (cascadedIds.length > 0) {
    const splitsTemplate = resolveSplitsCreateInput(
      params.occurrenceValue,
      params.signedAmount,
    );
    await prisma.transactionSplit.createMany({
      data: cascadedIds.flatMap((transactionId) =>
        splitsTemplate.map((split) => ({ transactionId, ...split })),
      ),
    });
  }

  return cascadedIds.length;
}

// ---------------------------------------------------------------------
// Shared: delete, extend generation
// ---------------------------------------------------------------------

// Deletes the rule AND its still-future, still-Pendente occurrences;
// past/Concluída ones stay in the user's history untouched (whatever's
// left after the cascade just loses its recurrenceId, per the schema's
// `onDelete: SetNull` on Transaction.recurrence). Same Q&A as
// update*Recurrence above — see tasks/012.md's Open Questions. No extra
// handling needed for the rule's own RecurrenceSplit rows below —
// `onDelete: Cascade` on RecurrenceSplit.recurrence (prisma/schema.prisma)
// already cleans those up at the database level the moment the
// Recurrence row itself is deleted. Shared by both debit and credit rows
// — there's no kind-specific branch needed here.
export async function deleteRecurrence(id: string) {
  const userId = await requireUserId();

  const existing = await prisma.recurrence.findUnique({ where: { id, userId } });
  if (!existing) {
    return { error: "Not found" };
  }

  const todayDate = parseCalendarDate(todayCalendarDate());

  await prisma.transaction.deleteMany({
    where: {
      recurrenceId: id,
      userId,
      status: "PENDING",
      date: { gte: todayDate },
    },
  });

  await prisma.recurrence.delete({ where: { id } });

  revalidateAll();
  return { error: null };
}

// Generates the next GENERATION_WINDOW_MONTHS-month batch of occurrences
// for a recurrence that's running low on runway, or has none at all
// (e.g. it was left paused after the user previously declined to extend
// — see the "Fica pausada" decision: declining just leaves the rule as-
// is, resumable any time). This is that resume action — triggered from
// the "gerar mais" affordance the list shows wherever listRecurrences
// flagged needsExtension. Regenerates from the recurrence's OWN stored
// template (content, card, splits) rather than any form state, since
// there's no form open when this runs — works the same regardless of
// whether the rule is debit or credit, since it's driven entirely by the
// account's own type.
export async function extendRecurrenceGeneration(id: string) {
  const userId = await requireUserId();

  const recurrence = await prisma.recurrence.findUnique({
    where: { id, userId },
    include: {
      account: { include: { creditCardDetails: true } },
      splits: true,
      transactions: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
    },
  });
  if (!recurrence) {
    return { error: "Not found" };
  }
  if (recurrence.account.type === "CREDIT_CARD" && !recurrence.account.creditCardDetails) {
    return { error: "Invalid account" };
  }

  const todayDate = parseCalendarDate(todayCalendarDate());
  const lastGeneratedDate = recurrence.transactions[0]?.date ?? null;
  // Resume the day after whatever's already generated (stepped by the
  // rule's own frequency) — or, if nothing has ever been generated,
  // from the rule's original startDate if that's still ahead, else from
  // today. Never restart from startDate when something HAS already been
  // generated: Transaction has no unique constraint on
  // (recurrenceId, date), so that would silently create duplicate rows
  // rather than erroring.
  const resumeFrom = lastGeneratedDate
    ? stepOccurrenceDate(lastGeneratedDate, recurrence.frequency)
    : recurrence.startDate > todayDate
      ? recurrence.startDate
      : todayDate;

  const windowEnd = fromAppZoned(
    addMonths(toAppZoned(todayDate), GENERATION_WINDOW_MONTHS),
  );
  const generateUntil =
    recurrence.endDate && recurrence.endDate < windowEnd
      ? recurrence.endDate
      : windowEnd;

  if (resumeFrom > generateUntil) {
    // Already fully generated through its endDate, or the new window
    // doesn't reach any further than what's already there — nothing to
    // do. Not an error: "gerar mais" on an already-up-to-date recurrence
    // (e.g. a stale button the user clicks twice) should just quietly
    // no-op rather than fail.
    return { error: null, generatedCount: 0 };
  }

  const value: OccurrenceContent = {
    accountId: recurrence.accountId,
    categoryId: recurrence.categoryId ?? "",
    cardId: recurrence.cardId ?? "",
    paymentMethod: recurrence.paymentMethod ?? "",
    description: recurrence.description,
    type: recurrence.amount.toNumber() < 0 ? "expense" : "income",
    personId: recurrence.splits[0]?.personId ?? "",
    splits: recurrence.splits.map((split) => ({
      personId: split.personId,
      amount: Math.abs(split.amount.toNumber()),
    })),
  };
  const signedAmount = recurrence.amount.toNumber();

  let occurrenceDate = resumeFrom;
  let generatedCount = 0;
  while (occurrenceDate <= generateUntil) {
    await createRecurrenceOccurrence({
      userId,
      value,
      amount: signedAmount,
      date: occurrenceDate,
      recurrenceId: recurrence.id,
      account: recurrence.account,
      todayDate,
    });
    generatedCount++;
    occurrenceDate = stepOccurrenceDate(occurrenceDate, recurrence.frequency);
  }

  revalidatePath("/recurrences");
  revalidatePath("/transactions");
  return { error: null, generatedCount };
}

// "Adiantar" — settles the recurrence's soonest still-PENDING occurrence
// today instead of waiting for its own scheduled date: moves that one
// Transaction's date to today and marks it COMPLETED, same as paying a
// bill early. Works the same regardless of frequency (daily/weekly/
// monthly) — always just the single next-due row, never a whole month's
// worth for a daily/weekly rule. Only ever touches ONE occurrence per
// call; the rest of the schedule (and every other future occurrence) is
// untouched.
export async function advanceRecurrenceOccurrence(id: string) {
  const userId = await requireUserId();

  const recurrence = await prisma.recurrence.findUnique({
    where: { id, userId },
    select: { id: true },
  });
  if (!recurrence) {
    return { error: "Not found" };
  }

  const nextOccurrence = await prisma.transaction.findFirst({
    where: { recurrenceId: id, status: "PENDING" },
    orderBy: { date: "asc" },
  });
  if (!nextOccurrence) {
    const t = await getTranslations("scrn-recurrences");
    return { error: t("errors.noPendingOccurrence") };
  }

  await prisma.transaction.update({
    where: { id: nextOccurrence.id },
    data: {
      date: parseCalendarDate(todayCalendarDate()),
      status: "COMPLETED",
    },
  });

  revalidatePath("/recurrences");
  revalidatePath("/transactions");
  return { error: null };
}
