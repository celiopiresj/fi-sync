"use server";

import { addDays, addMonths, addWeeks } from "date-fns";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth/server";
import { parseCalendarDate, toAppZoned, fromAppZoned } from "@/lib/date";
import { computeInvoiceCycle, resolveInvoiceForDate } from "@/lib/invoice-resolution";
import { recomputeInvoiceStatus } from "@/lib/invoice-total";
import {
  debitTransactionSchema,
  refineDebitTransaction,
  creditTransactionSchema,
  refineCreditTransaction,
  batchRowSchema,
  creditBatchRowSchema,
  transactionFormStatusValues,
  type BatchRowFormValues,
  type BatchRowValues,
  type CreditBatchRowFormValues,
  type CreditBatchRowValues,
  type RecurrenceFrequencyOption,
  type DebitTransactionFormValues,
  type DebitTransactionValues,
  type CreditTransactionFormValues,
  type CreditTransactionValues,
} from "./_schema/schema";
import { periodRange, shiftPeriod, type Period } from "./_lib/period";
import { formatMonthAbbreviationPtBr } from "./_lib/format-month-label";

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// Best guess for who a new transaction/batch row should default to, so
// the Pessoa field isn't just empty every time — tried in order:
//  1. Whoever was attributed most recently. Transaction has no
//     createdAt/updatedAt (only the user-editable business `date`), so
//     `date desc` is the best available proxy for "last used."
//  2. Whoever appears in the most splits overall (no recent activity,
//     but a clear favorite).
//  3. First person alphabetically — `people` is already ordered by name.
//     Person has no self/owner linkage in the schema, so there's no
//     "o próprio usuário" row to prefer here; this is just the plainest
//     deterministic fallback.
// Returns null only when the user has no People at all.
async function computeDefaultPersonId(
  userId: string,
  people: { id: string }[],
) {
  if (people.length === 0) return null;

  const lastSplit = await prisma.transactionSplit.findFirst({
    where: { transaction: { userId } },
    orderBy: { transaction: { date: "desc" } },
    select: { personId: true },
  });
  if (lastSplit) return lastSplit.personId;

  const mostFrequent = await prisma.person.findFirst({
    where: { userId },
    orderBy: { splits: { _count: "desc" } },
    select: { id: true, _count: { select: { splits: true } } },
  });
  if (mostFrequent && mostFrequent._count.splits > 0) return mostFrequent.id;

  return people[0].id;
}

// Data every instance of the create/edit dialogs needs for their
// selects — one shared account list for both the debit and credit forms
// (tasks/015.md reunited them on this screen), with `cards` included so
// the credit form's own card picker doesn't need a separate fetch.
// Non-credit-card accounts simply have an empty `cards` array.
export async function getTransactionFormOptions() {
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

  const defaultPersonId = await computeDefaultPersonId(userId, people);

  return { accounts, categories, people, defaultPersonId };
}

export type TransactionFilters = {
  accountId?: string;
  categoryId?: string;
  personId?: string;
  search?: string;
  from?: string;
  to?: string;
  type?: "all" | "income" | "expenses";
};

export async function listTransactions(filters: TransactionFilters = {}) {
  const userId = await requireUserId();

  const where: Record<string, unknown> = { userId };
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.personId) {
    // An unattributed transaction (no splits at all) is implicitly the
    // user's own (same convention transactions/columns.tsx's `selfLabel`
    // fallback and projections/_lib/self-share.ts both rely on) — so
    // filtering by the Person marked isSelf has to match those rows too,
    // not just ones with an explicit split naming them.
    const person = await prisma.person.findUnique({
      where: { id: filters.personId, userId },
      select: { isSelf: true },
    });
    where.OR = person?.isSelf
      ? [
          { splits: { some: { personId: filters.personId } } },
          { splits: { none: {} } },
        ]
      : [{ splits: { some: { personId: filters.personId } } }];
  }
  if (filters.search) {
    where.description = { contains: filters.search, mode: "insensitive" };
  }
  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from ? { gte: parseCalendarDate(filters.from) } : {}),
      ...(filters.to ? { lte: parseCalendarDate(filters.to) } : {}),
    };
  }
  if (filters.type === "income") where.amount = { gt: 0 };
  if (filters.type === "expenses") where.amount = { lt: 0 };

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      account: { select: { id: true, name: true, type: true } },
      category: { select: { id: true, name: true, icon: true } },
      splits: { include: { person: { select: { id: true, name: true } } } },
      // Only ever set for a credit-card purchase (tasks/015.md) — used by
      // the table/mobile list to show which physical card was used, and
      // by the credit form to prefill `cardId` when editing.
      transactionCard: {
        include: { card: { select: { id: true, name: true, lastFourDigits: true } } },
      },
    },
    orderBy: { date: "desc" },
  });

  // Decimal isn't a plain serializable value across the Server
  // Action/Client Component boundary — convert once here instead of at
  // every call site.
  return transactions.map((transaction) => ({
    ...transaction,
    amount: transaction.amount.toNumber(),
    splits: transaction.splits.map((split) => ({
      ...split,
      amount: split.amount.toNumber(),
    })),
  }));
}

export type MonthlyBalance = { month: string; monthLabel: string; balance: number };

// The 6 months before `anchorPeriod` plus `anchorPeriod` itself, oldest
// first — anchored to whatever month the header's period stepper is
// currently showing (transactions-view.tsx passes its `period` state
// through), not always "now": stepping the header back/forward re-centers
// this chart on the newly selected month instead of leaving it pinned to
// the real current month. Still a standing 7-month history, not a
// filtered recort of the visible list — only the account filter applies,
// if the screen has one active; search/category/type don't, since this
// chart isn't scoped to "what's currently visible," just "which account,
// which trailing window." Summed in the database (one aggregate query
// per month, run in parallel) rather than pulling 6 months of raw
// transactions to the client to add up. The returned array is built
// oldest-to-newest, so the LAST entry is always `anchorPeriod` by
// construction — MonthlyBalanceChart relies on that for highlighting
// instead of a separate flag.
export async function getMonthlyBalances(
  anchorPeriod: Period,
  accountId?: string,
): Promise<MonthlyBalance[]> {
  const userId = await requireUserId();

  const periods = Array.from({ length: 7 }, (_, index) =>
    shiftPeriod(anchorPeriod, index - 6),
  );

  const sums = await Promise.all(
    periods.map((period) => {
      const { from, to } = periodRange(period);
      return prisma.transaction.aggregate({
        where: {
          userId,
          ...(accountId ? { accountId } : {}),
          date: { gte: parseCalendarDate(from), lte: parseCalendarDate(to) },
        },
        _sum: { amount: true },
      });
    }),
  );

  return periods.map((period, index) => ({
    month: `${period.year}-${String(period.month + 1).padStart(2, "0")}`,
    monthLabel: formatMonthAbbreviationPtBr(period.month),
    balance: sums[index]!._sum.amount?.toNumber() ?? 0,
  }));
}

export type CategoryBreakdownItem = { id: string; name: string; total: number };
export type CategoryBreakdown = {
  items: CategoryBreakdownItem[];
  totalExpenses: number;
};

// Expenses-only breakdown by category for the currently selected period,
// respecting every filter `listTransactions` itself respects (account,
// category, search, date range) — unlike getMonthlyBalances above, this
// one IS a filtered recort of "what's currently visible," just grouped
// and summed by category instead of listed row by row. `type` is
// deliberately not part of the accepted filter shape: this is hardcoded
// to expenses only regardless of the screen's income/expenses/all
// toggle, since showing where money went is the whole point of the
// card. Grouped/summed in the database (`groupBy`), not by pulling every
// matching transaction to the client to add up. Uncategorized
// transactions (categoryId null) are bucketed under a single
// "chart.byCategory.uncategorized" row rather than dropped.
// Explicit shape for prisma.transaction.groupBy's result below — spelled
// out (rather than left to inference) so downstream .map/.filter/.sort
// chains type-check even in environments where the generated Prisma
// client isn't resolvable at typecheck time; `{ toNumber(): number }` is
// the Decimal surface this file actually uses, not the full Decimal type.
type CategoryGroupRow = {
  categoryId: string | null;
  _sum: { amount: { toNumber(): number } | null };
};

export async function getCategoryExpenseBreakdown(
  filters: Pick<
    TransactionFilters,
    "accountId" | "categoryId" | "search" | "from" | "to"
  > = {},
): Promise<CategoryBreakdown> {
  const userId = await requireUserId();

  const where: Record<string, unknown> = { userId, amount: { lt: 0 } };
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.search) {
    where.description = { contains: filters.search, mode: "insensitive" };
  }
  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from ? { gte: parseCalendarDate(filters.from) } : {}),
      ...(filters.to ? { lte: parseCalendarDate(filters.to) } : {}),
    };
  }

  // No `: CategoryGroupRow[]` annotation here (unlike the `.map`/`filter`
  // callbacks below, which keep theirs) — Prisma's `groupBy` overload
  // resolves `T` partly by unifying the call's OWN return type against
  // whatever the call site expects, so a contextual array type here
  // constrains the args themselves and breaks inference (surfaced as a
  // baffling "missing length/pop/push/concat..." error). Left to infer
  // its real (richer) Prisma payload type instead; that type is a
  // structural superset of CategoryGroupRow, so every downstream
  // `(group: CategoryGroupRow) => ...` below still type-checks against it.
  const grouped = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where,
    _sum: { amount: true },
  });

  const categoryIds = grouped
    .map((group: CategoryGroupRow) => group.categoryId)
    .filter((id): id is string => id !== null);
  // Explicit type for the same reason as CategoryGroupRow above: without
  // it, `categories` resolves to `any` (the unresolvable generated Prisma
  // client), which makes `new Map(categories.map(...))` below infer
  // `Map<unknown, unknown>` instead of `Map<string, string>` — and
  // `Map<unknown,...>.get(...) ?? ""` collapses to TypeScript's `{}`
  // type rather than `string`.
  const categories: { id: string; name: string }[] = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const categoryNameById = new Map(
    categories.map(
      (category: { id: string; name: string }): [string, string] => [
        category.id,
        category.name,
      ],
    ),
  );

  const t = await getTranslations("scrn-transactions");

  const uncategorizedLabel: string = t("chart.byCategory.uncategorized");

  const items = grouped
    .map((group: CategoryGroupRow): CategoryBreakdownItem => {
      const name: string = group.categoryId
        ? (categoryNameById.get(group.categoryId) ?? "")
        : uncategorizedLabel;
      return {
        id: group.categoryId ?? "uncategorized",
        name,
        total: Math.abs(group._sum.amount?.toNumber() ?? 0),
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  const totalExpenses = items.reduce((sum, item) => sum + item.total, 0);

  return { items, totalExpenses };
}

// Read-only "which invoice will this land in" preview for the credit
// form — never creates an Invoice row, just tells the user what would
// happen at save time.
export async function previewInvoiceCycle(accountId: string, dateStr: string) {
  const userId = await requireUserId();
  if (!accountId || !dateStr) return null;
  const fromDate = parseCalendarDate(dateStr);

  const account = await prisma.account.findUnique({
    where: { id: accountId, userId },
    include: { creditCardDetails: true },
  });
  if (!account?.creditCardDetails) return null;

  const existing = await prisma.invoice.findFirst({
    where: { accountId, closingDate: { gte: fromDate } },
    orderBy: { closingDate: "asc" },
  });

  if (existing) {
    return {
      closingDate: existing.closingDate,
      dueDate: existing.dueDate,
      existing: true,
    };
  }

  const { closingDate, dueDate } = computeInvoiceCycle(fromDate, account.creditCardDetails);
  return { closingDate, dueDate, existing: false };
}

function stepDate(date: Date, frequency: RecurrenceFrequencyOption) {
  if (frequency === "none") return date;
  // Do the arithmetic on the App-timezone wall-clock digits, not the
  // server process's own timezone — see src/lib/date.ts.
  const zoned = toAppZoned(date);
  switch (frequency) {
    case "daily":
      return fromAppZoned(addDays(zoned, 1));
    case "weekly":
      return fromAppZoned(addWeeks(zoned, 1));
    case "monthly":
      return fromAppZoned(addMonths(zoned, 1));
  }
}

// Reconciles the top-level `personId` field with the opt-in `splits`
// array into Prisma's `splits.create` input — shared by both the debit
// and credit paths below, since debitTransactionSchema and
// creditTransactionSchema both end up with the same
// `{ personId, splits, type }` shape here. See the personId/splits
// comments on debitTransactionSchema in _schema/schema.ts.
function resolveSplitsCreateInput(
  value: { personId: string; splits: { personId: string; amount: number }[]; type: "income" | "expense" },
  amount: number,
) {
  if (value.splits.length > 0) {
    return value.splits.map((split) => ({
      personId: split.personId,
      amount: value.type === "expense" ? -split.amount : split.amount,
    }));
  }
  if (value.personId) {
    return [{ personId: value.personId, amount }];
  }
  return null;
}

function revalidateTransactions() {
  revalidatePath("/transactions");
}

// Also revalidates /invoices and /cards — a credit-card purchase affects
// the invoice it landed in and the card's available limit shown there.
// /people and /projections too — both read Transaction/TransactionSplit
// data directly (person balances, the self-share cash-flow projection).
function revalidateCreditTransactions() {
  revalidatePath("/transactions");
  revalidatePath("/invoices");
  revalidatePath("/cards");
  revalidatePath("/people");
  revalidatePath("/projections");
}

// If `transactionIds` includes a settlement expense payInvoice
// (invoices/actions.ts) created for a card invoice payment
// (InvoicePayment.transactionId), deleting that row would otherwise
// leave the invoice's cached status/paidAmount stale (still counting
// money that no longer has a transaction behind it). Must be called
// BEFORE the delete (it needs to see the InvoicePayment/InvoiceCredit
// rows that are about to cascade away) — pair with recomputeAffectedInvoices
// AFTER the delete, both inside the same $transaction as the actual
// tx.transaction.deleteMany so the whole thing is atomic.
//
// An invoice a deleted payment had funded a CREDIT toward (its own
// overflow, see payInvoice's applyOverflowCredit) is captured here too
// (`targetInvoiceId`) — deleting the settlement Transaction cascades
// (schema.prisma) through InvoicePayment straight to any InvoiceCredit
// it had generated, so that credit needs recomputing as well.
// recomputeInvoiceStatus is itself transitive, so a credit chain (A
// funded B, B's own resulting overflow funded C) unwinds correctly once
// every directly and indirectly affected invoice here gets recomputed.
async function invoiceIdsAffectedByDeleting(
  tx: Prisma.TransactionClient,
  userId: string,
  transactionIds: string[],
): Promise<string[]> {
  const payments = await tx.invoicePayment.findMany({
    where: { transactionId: { in: transactionIds }, invoice: { account: { userId } } },
    select: {
      invoiceId: true,
      creditsGiven: { select: { targetInvoiceId: true } },
    },
  });

  const affectedInvoiceIds = new Set<string>();
  for (const payment of payments) {
    affectedInvoiceIds.add(payment.invoiceId);
    for (const credit of payment.creditsGiven) {
      affectedInvoiceIds.add(credit.targetInvoiceId);
    }
  }
  return [...affectedInvoiceIds];
}

// See invoiceIdsAffectedByDeleting above — call this AFTER the delete
// with the ids it returned, so each invoice's cached status/paidAmount
// is recomputed from whatever InvoicePayment/InvoiceCredit rows actually
// survived.
async function recomputeAffectedInvoices(
  tx: Prisma.TransactionClient,
  invoiceIds: string[],
) {
  const visited = new Set<string>();
  for (const invoiceId of invoiceIds) {
    await recomputeInvoiceStatus(tx, invoiceId, visited);
  }
}

// ---------------------------------------------------------------------
// Debit / everyday transactions
// ---------------------------------------------------------------------

async function validateDebit(data: DebitTransactionFormValues) {
  const t = await getTranslations("scrn-transactions");
  const tValidation = await getTranslations("common.validation");

  const schema = debitTransactionSchema.superRefine((value, ctx) =>
    refineDebitTransaction(value, ctx, {
      messages: {
        paymentMethodRequired: tValidation("required"),
        splitsMismatch: t("splits.mismatch"),
      },
    }),
  );

  return schema.safeParse(data);
}

// Creates one Transaction row (plus its splits) at a specific date —
// shared by the recurrence loop and the plain single-row path below. No
// card/invoice linking here — that's the credit path's job.
async function createDebitTransactionRow(params: {
  userId: string;
  value: DebitTransactionValues;
  amount: number;
  date: Date;
  recurrenceId?: string;
}) {
  const { value, amount, date } = params;

  const splitsCreateInput = resolveSplitsCreateInput(value, amount);

  await prisma.transaction.create({
    data: {
      userId: params.userId,
      accountId: value.accountId,
      categoryId: value.categoryId || undefined,
      description: value.description,
      amount,
      date,
      status: value.status,
      paymentMethod:
        value.paymentMethod === "" ? undefined : value.paymentMethod,
      recurrenceId: params.recurrenceId,
      splits: splitsCreateInput ? { create: splitsCreateInput } : undefined,
    },
  });
}

export async function createDebitTransaction(data: DebitTransactionFormValues) {
  const userId = await requireUserId();
  const result = await validateDebit(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;
  const signedAmount = value.type === "expense" ? -value.amount : value.amount;

  const account = await prisma.account.findUnique({
    where: { id: value.accountId, userId },
  });
  if (!account) {
    return { error: "Invalid account" };
  }

  if (value.recurrence !== "none") {
    const recurrence = await prisma.recurrence.create({
      data: {
        userId,
        accountId: value.accountId,
        categoryId: value.categoryId || undefined,
        description: value.description,
        amount: signedAmount,
        frequency: value.recurrence.toUpperCase() as "DAILY" | "WEEKLY" | "MONTHLY",
        startDate: parseCalendarDate(value.date),
      },
    });

    let occurrenceDate = parseCalendarDate(value.date);

    for (let index = 0; index < value.recurrenceCount; index++) {
      await createDebitTransactionRow({
        userId,
        value,
        amount: signedAmount,
        date: occurrenceDate,
        recurrenceId: recurrence.id,
      });
      occurrenceDate = stepDate(occurrenceDate, value.recurrence);
    }

    revalidateTransactions();
    return { error: null };
  }

  await createDebitTransactionRow({
    userId,
    value,
    amount: signedAmount,
    date: parseCalendarDate(value.date),
  });

  revalidateTransactions();
  return { error: null };
}

export async function updateDebitTransaction(
  id: string,
  data: DebitTransactionFormValues,
) {
  const userId = await requireUserId();
  const result = await validateDebit(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;
  const signedAmount = value.type === "expense" ? -value.amount : value.amount;

  const existing = await prisma.transaction.findUnique({
    where: { id, userId },
  });
  if (!existing) {
    return { error: "Not found" };
  }

  await prisma.transactionSplit.deleteMany({ where: { transactionId: id } });

  const splitsCreateInput = resolveSplitsCreateInput(value, signedAmount);

  await prisma.transaction.update({
    where: { id },
    data: {
      accountId: value.accountId,
      categoryId: value.categoryId || null,
      description: value.description,
      amount: signedAmount,
      date: parseCalendarDate(value.date),
      status: value.status,
      paymentMethod: value.paymentMethod === "" ? null : value.paymentMethod,
      splits: splitsCreateInput ? { create: splitsCreateInput } : undefined,
    },
  });

  revalidateTransactions();
  return { error: null };
}

// ---------------------------------------------------------------------
// Credit card purchases
// ---------------------------------------------------------------------

async function validateCredit(data: CreditTransactionFormValues) {
  const t = await getTranslations("scrn-transactions");

  const schema = creditTransactionSchema.superRefine((value, ctx) =>
    refineCreditTransaction(value, ctx, {
      splitsMismatch: t("splits.mismatch"),
      recurrenceInstallmentConflict: t("recurrence.conflict"),
    }),
  );

  return schema.safeParse(data);
}

// Creates one Transaction row (plus its splits, card, and invoice links)
// at a specific date — shared by the installment loop and the recurrence
// loop below. `cursorDate` advances past whichever invoice this row
// landed in, so consecutive installments spread across consecutive
// billing cycles instead of all landing in the same one.
async function createCreditTransactionRow(params: {
  userId: string;
  // A structural subset of CreditTransactionValues rather than the full
  // type — shared by the single-form create path (which passes the real
  // parsed value) and createCreditTransactionsBatch below (which builds
  // a synthetic one per queued row, since a batch row has no
  // recurrence/installmentAmountMode of its own).
  value: Pick<
    CreditTransactionValues,
    "accountId" | "cardId" | "categoryId" | "description" | "status" | "personId" | "splits" | "type"
  >;
  amount: number;
  date: Date;
  creditCardDetails: { closingDay: number; dueDay: number };
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentCount?: number;
  recurrenceId?: string;
  cursorDate: Date;
}) {
  const { value, amount, date, creditCardDetails, cursorDate } = params;

  const splitsCreateInput = resolveSplitsCreateInput(value, amount);

  const transaction = await prisma.transaction.create({
    data: {
      userId: params.userId,
      accountId: value.accountId,
      categoryId: value.categoryId || undefined,
      description: value.description,
      amount,
      date,
      status: value.status,
      installmentGroupId: params.installmentGroupId,
      installmentNumber: params.installmentNumber,
      installmentCount: params.installmentCount,
      recurrenceId: params.recurrenceId,
      splits: splitsCreateInput ? { create: splitsCreateInput } : undefined,
    },
  });

  const invoice = await resolveInvoiceForDate(value.accountId, cursorDate, creditCardDetails);
  const nextCursorDate = fromAppZoned(addMonths(toAppZoned(invoice.closingDate), 1));

  await prisma.transactionInvoice.create({
    data: { transactionId: transaction.id, invoiceId: invoice.id },
  });
  await prisma.transactionCard.create({
    data: { transactionId: transaction.id, cardId: value.cardId },
  });

  return { transaction, nextCursorDate };
}

export async function createCreditTransaction(data: CreditTransactionFormValues) {
  const userId = await requireUserId();
  const result = await validateCredit(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;
  const signedAmount = value.type === "expense" ? -value.amount : value.amount;

  const account = await prisma.account.findUnique({
    where: { id: value.accountId, userId },
    include: { creditCardDetails: true },
  });
  if (!account || account.type !== "CREDIT_CARD" || !account.creditCardDetails) {
    return { error: "Invalid account" };
  }
  const creditCardDetails = account.creditCardDetails;

  // Recorrência and installments are mutually exclusive (enforced in
  // refineCreditTransaction) — recurrence generates N independent
  // transactions, one per date, sharing a lightweight `Recurrence` rule
  // row (same "recorrência rápida" shortcut the debit form offers — no
  // RecurrenceSplit template, since every generated occurrence closes
  // over this same `value` directly instead).
  if (value.recurrence !== "none") {
    const recurrence = await prisma.recurrence.create({
      data: {
        userId,
        accountId: value.accountId,
        categoryId: value.categoryId || undefined,
        description: value.description,
        amount: signedAmount,
        frequency: value.recurrence.toUpperCase() as "DAILY" | "WEEKLY" | "MONTHLY",
        startDate: parseCalendarDate(value.date),
      },
    });

    let occurrenceDate = parseCalendarDate(value.date);

    for (let index = 0; index < value.recurrenceCount; index++) {
      await createCreditTransactionRow({
        userId,
        value,
        amount: signedAmount,
        date: occurrenceDate,
        creditCardDetails,
        recurrenceId: recurrence.id,
        cursorDate: occurrenceDate,
      });
      occurrenceDate = stepDate(occurrenceDate, value.recurrence);
    }

    revalidateCreditTransactions();
    return { error: null };
  }

  const installmentCount = value.installments;
  const installmentGroupId = installmentCount > 1 ? crypto.randomUUID() : undefined;
  // "total": the typed amount is the whole purchase, split evenly across
  // installments. "perInstallment": the typed amount is already what
  // each installment charges — used as-is.
  const installmentAmount =
    value.installmentAmountMode === "perInstallment"
      ? signedAmount
      : signedAmount / installmentCount;

  let cursorDate = parseCalendarDate(value.date);

  for (let index = 0; index < installmentCount; index++) {
    const { nextCursorDate } = await createCreditTransactionRow({
      userId,
      value,
      amount: installmentAmount,
      date: parseCalendarDate(value.date),
      creditCardDetails,
      installmentGroupId,
      installmentNumber: installmentGroupId ? index + 1 : undefined,
      installmentCount: installmentGroupId ? installmentCount : undefined,
      cursorDate,
    });
    cursorDate = nextCursorDate;
  }

  revalidateCreditTransactions();
  return { error: null };
}

// v1 limitation: editing doesn't let you change installment count — only
// the base fields, category, card, and splits. Re-doing installments/
// invoices on edit is future work.
export async function updateCreditTransaction(
  id: string,
  data: CreditTransactionFormValues,
) {
  const userId = await requireUserId();
  const result = await validateCredit(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;
  const signedAmount = value.type === "expense" ? -value.amount : value.amount;

  const existing = await prisma.transaction.findUnique({ where: { id, userId } });
  if (!existing) {
    return { error: "Not found" };
  }

  await prisma.transactionSplit.deleteMany({ where: { transactionId: id } });
  const splitsCreateInput = resolveSplitsCreateInput(value, signedAmount);

  await prisma.transaction.update({
    where: { id },
    data: {
      accountId: value.accountId,
      categoryId: value.categoryId || null,
      description: value.description,
      amount: signedAmount,
      date: parseCalendarDate(value.date),
      status: value.status,
      splits: splitsCreateInput ? { create: splitsCreateInput } : undefined,
    },
  });

  await prisma.transactionCard.upsert({
    where: { transactionId: id },
    update: { cardId: value.cardId },
    create: { transactionId: id, cardId: value.cardId },
  });

  revalidateCreditTransactions();
  return { error: null };
}

// Credit-card counterpart of createTransactionsBatch (debit) below — one
// queued row per purchase, each independently installment-able. Unlike
// the debit batch, this can't be wrapped in a single `prisma.$transaction`
// array: `resolveInvoiceForDate` isn't safe under concurrent calls for
// the same account (see src/lib/invoice-resolution.ts), and an
// installment loop already depends on the previous installment's
// resulting invoice to pick the next cursor date. So every row — and
// every installment within a row — runs sequentially, same constraint
// createCreditTransaction's own installment loop already has; this
// isn't all-or-nothing the way the debit batch is, but that's an
// accepted trade-off for reusing the exact same invoice-resolution path.
export async function createCreditTransactionsBatch(
  rows: CreditBatchRowFormValues[],
) {
  const userId = await requireUserId();

  const parsedRows: { index: number; value: CreditBatchRowValues }[] = [];

  for (let index = 0; index < rows.length; index++) {
    const result = creditBatchRowSchema.safeParse(rows[index]);
    if (!result.success) {
      return {
        error: result.error.issues[0]?.message ?? "Invalid data",
        rowIndex: index,
      };
    }
    parsedRows.push({ index, value: result.data });
  }

  const t = await getTranslations("scrn-transactions");

  // Mirrors the debit batch's own personId check (see the comment on
  // createTransactionsBatch below) — enforced here rather than in the
  // schema so the message can be translated.
  for (const { index, value } of parsedRows) {
    if (!value.personId) {
      return { error: t("batch.personRequired"), rowIndex: index };
    }
  }

  // Every row's account must actually be a credit-card account with
  // billing details — CreditBatchTransactionTable already only offers
  // credit-card accounts in its picker, so this is the server-side
  // backstop for a stale client submitting one that no longer qualifies
  // (e.g. deleted in another tab in between).
  const accountIds = [
    ...new Set(parsedRows.map(({ value }) => value.accountId)),
  ];
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds }, userId, type: "CREDIT_CARD" },
    include: { creditCardDetails: true },
  });
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  for (const { index, value } of parsedRows) {
    if (!accountById.get(value.accountId)?.creditCardDetails) {
      return { error: t("batch.creditCardRequired"), rowIndex: index };
    }
  }

  for (const { value } of parsedRows) {
    const account = accountById.get(value.accountId)!;
    const creditCardDetails = account.creditCardDetails!;
    const signedAmount = value.type === "expense" ? -value.amount : value.amount;

    const installmentCount = value.installments;
    const installmentGroupId = installmentCount > 1 ? crypto.randomUUID() : undefined;
    // A batch row's typed amount is always the purchase total, split
    // evenly across installments — see the comment on
    // creditBatchRowSchema (no installmentAmountMode here).
    const installmentAmount = signedAmount / installmentCount;

    let cursorDate = parseCalendarDate(value.date);

    for (let index = 0; index < installmentCount; index++) {
      const { nextCursorDate } = await createCreditTransactionRow({
        userId,
        value: {
          accountId: value.accountId,
          cardId: value.cardId,
          categoryId: value.categoryId,
          description: value.description,
          status: "COMPLETED",
          personId: value.personId,
          splits: [],
          type: value.type,
        },
        amount: installmentAmount,
        date: parseCalendarDate(value.date),
        creditCardDetails,
        installmentGroupId,
        installmentNumber: installmentGroupId ? index + 1 : undefined,
        installmentCount: installmentGroupId ? installmentCount : undefined,
        cursorDate,
      });
      cursorDate = nextCursorDate;
    }
  }

  revalidateCreditTransactions();
  return { error: null, rowIndex: null };
}

// ---------------------------------------------------------------------
// Shared: delete, bulk actions, batch entry
// ---------------------------------------------------------------------

// Shared by both debit and credit rows — Prisma's onDelete: Cascade
// already tears down TransactionSplit/TransactionCard/TransactionInvoice,
// so there's no kind-specific branch needed here. Revalidates the
// credit-only paths too rather than looking up the row's account type
// first — an extra revalidation on a debit delete is harmless.
export async function deleteTransaction(id: string) {
  const userId = await requireUserId();

  await prisma.$transaction(async (tx) => {
    const affectedInvoiceIds = await invoiceIdsAffectedByDeleting(tx, userId, [id]);
    await tx.transaction.deleteMany({ where: { id, userId } });
    await recomputeAffectedInvoices(tx, affectedInvoiceIds);
  });

  revalidateCreditTransactions();
  return { error: null };
}

// Multi-select bulk actions (transactions table toolbar) — correcting an
// imported month one field at a time is the exact cost this exists to
// remove, so both operations below apply to the whole selection in one
// round trip instead of one Server Action call per row.
//
// `status` is deliberately typed off `transactionFormStatusValues`
// (excludes FAILED), not the full TransactionStatus enum — same
// rationale as the single-transaction form (see the comment on
// transactionFormStatusValues in _schema/schema.ts): FAILED is something
// an automated flow sets, not something a person bulk-assigns.
export type BulkStatus = (typeof transactionFormStatusValues)[number];

export type BulkUpdatePatch =
  | { categoryId: string | null; status?: undefined }
  | { status: BulkStatus; categoryId?: undefined };

export async function updateTransactionsBulk(
  ids: string[],
  patch: BulkUpdatePatch,
) {
  const userId = await requireUserId();
  if (ids.length === 0) return { error: null, count: 0 };

  const result = await prisma.transaction.updateMany({
    where: { id: { in: ids }, userId },
    data: {
      ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    },
  });

  revalidateTransactions();
  return { error: null, count: result.count };
}

export async function deleteTransactionsBulk(ids: string[]) {
  const userId = await requireUserId();
  if (ids.length === 0) return { error: null, count: 0 };

  const result = await prisma.$transaction(async (tx) => {
    const affectedInvoiceIds = await invoiceIdsAffectedByDeleting(tx, userId, ids);
    const deleteResult = await tx.transaction.deleteMany({ where: { id: { in: ids }, userId } });
    await recomputeAffectedInvoices(tx, affectedInvoiceIds);
    return deleteResult;
  });

  revalidateCreditTransactions();
  return { error: null, count: result.count };
}

// "Modo em lote" (tasks/006-transacoes-recursos-avancados.md): several
// plain transactions created together, one per table row. No splits
// (single required person instead), no card/installments/recurrence —
// each row is independent, debit-only, and can point at a different
// account. All or nothing: wrapped in a single prisma.$transaction.
export async function createTransactionsBatch(rows: BatchRowFormValues[]) {
  const userId = await requireUserId();

  const parsedRows: { index: number; value: BatchRowValues }[] = [];

  for (let index = 0; index < rows.length; index++) {
    const result = batchRowSchema.safeParse(rows[index]);
    if (!result.success) {
      return {
        error: result.error.issues[0]?.message ?? "Invalid data",
        rowIndex: index,
      };
    }
    parsedRows.push({ index, value: result.data });
  }

  // Batch entry is debit-only — BatchTransactionTable already hides
  // credit-card accounts from the picker, so this is the server-side
  // backstop for a stale client submitting one anyway. Without it the
  // row would create a real Transaction with no TransactionCard/
  // TransactionInvoice link, since none of that logic runs here the way
  // it does in createCreditTransaction.
  const accountIds = [
    ...new Set(parsedRows.map(({ value }) => value.accountId)),
  ];
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds }, userId },
    select: { id: true, type: true },
  });
  const accountTypeById = new Map(
    accounts.map((account) => [account.id, account.type]),
  );

  const t = await getTranslations("scrn-transactions");
  for (const { index, value } of parsedRows) {
    // Mirrors the debit form's rules (see refineDebitTransaction in
    // _schema/schema.ts): every row must be attributed to a person and
    // have a payment method. Both stay unrefined in `batchRowSchema`
    // itself so these checks can return a translated message — see the
    // comment there.
    if (!value.personId) {
      return { error: t("batch.personRequired"), rowIndex: index };
    }
    if (!value.paymentMethod) {
      return { error: t("batch.paymentMethodRequired"), rowIndex: index };
    }
    if (accountTypeById.get(value.accountId) === "CREDIT_CARD") {
      return { error: t("batch.creditCardNotAllowed"), rowIndex: index };
    }
  }

  await prisma.$transaction(
    parsedRows.map(({ value }) => {
      const signedAmount = value.type === "expense" ? -value.amount : value.amount;
      return prisma.transaction.create({
        data: {
          userId,
          accountId: value.accountId,
          categoryId: value.categoryId || undefined,
          description: value.description,
          amount: signedAmount,
          date: parseCalendarDate(value.date),
          status: "COMPLETED",
          paymentMethod: value.paymentMethod || undefined,
          splits: value.personId
            ? { create: [{ personId: value.personId, amount: signedAmount }] }
            : undefined,
        },
      });
    }),
  );

  revalidateTransactions();
  return { error: null, rowIndex: null };
}
