import { tool } from "ai";
import { z } from "zod";
import { addDays, addMonths } from "date-fns";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  dateOnlyKey,
  fromAppZoned,
  parseCalendarDate,
  toAppZoned,
  todayCalendarDate,
} from "@/lib/date";
import { computeInvoiceCycle, resolveInvoiceForDate } from "@/lib/invoice-resolution";
import { sumInvoiceTransactionsTotal } from "@/lib/invoice-total";
import { effectiveDateWhere } from "@/lib/transaction-period";
import { resolveSplitsCreateInput } from "@/lib/transaction-splits";
import { recurrenceWindowEnd, stepDate } from "@/lib/recurrence-window";
import { formatPersonName } from "@/lib/format-person-name";
import { AVAILABLE_COLORS } from "@/components/form/color-picker";
import { saveDraft } from "./draft";
import {
  ACCOUNT_TYPE_LABELS,
  CATEGORY_TYPE_LABELS,
  labelFor,
  PAYMENT_METHOD_LABELS,
  RECURRENCE_LABELS,
  TRANSACTION_KIND_LABELS,
  TRANSACTION_STATUS_LABELS,
} from "./labels";
import {
  ACCOUNT_KIND,
  CARD_KIND,
  CATEGORY_KIND,
  disambiguate,
  PERSON_KIND,
  resolveNamed,
} from "./resolve";
import { askToConfirm, confirmedLancamento, type LancamentoSummary } from "./summary";

// The bot's whole surface onto the user's data. Every tool here is built
// around a `userId` captured in the closure below — never a parameter the
// model can set — so there is no reachable shape of a tool call that
// reads or writes another user's rows. That's the same guarantee the
// Server Actions get from `requireUserId()`; the webhook has no session
// to derive it from, so it comes from the Telegram chat link instead
// (src/lib/telegram/link.ts).
//
// These deliberately do NOT reuse the "use server" actions under
// src/app/[locale]/(app)/**: those all resolve the user from the auth
// cookie, and adding a userId parameter to any of them would turn a
// session-scoped action into one that can act as anybody.
//
// Everything the model sees is sized against Groq's per-MINUTE token
// budget, because a tool-calling turn re-sends the whole prompt — these
// schemas and every earlier tool result included — on every step:
//   - Tools take NAMES, not ids. A cuid is 25 characters of nothing to a
//     model, it forces a listing round-trip before every write, and it
//     doesn't survive into the next turn anyway (the history is plain
//     text, src/lib/telegram/history.ts), so the confirmation turn used
//     to pay for the whole discovery a second time. Resolution happens in
//     resolve.ts, which asks rather than guesses when a name is
//     ambiguous.
//   - Nothing returns an id either, for the same reason: no tool needs
//     one any more.
//   - There is ONE create tool for lançamentos, not one per account type.
//     Two near-identical 15-field schemas were paid for on every step of
//     every turn, including the ones that never wrote anything.
//   - The create tool returns the finished pt-BR `reply` (built in
//     summary.ts) and the turn ends there (see agent.ts), which removes
//     the extra model call that existed only to rephrase a summary the
//     app had already worked out.

const MAX_ROWS = 25;

// Mirrors `paymentMethodFormValues` in transactions/_schema/schema.ts:
// CREDIT_CARD is deliberately absent. This field describes money leaving
// an account immediately; on a credit-card account the card itself is the
// payment method, and this value is ignored.
const debitPaymentMethodValues = [
  "CASH",
  "DEBIT_CARD",
  "BANK_TRANSFER",
  "PIX",
  "BOLETO",
  "OTHER",
] as const;

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD")
  .describe("YYYY-MM-DD. Defaults to today.");

const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Use o formato AAAA-MM")
  .describe("YYYY-MM. Defaults to the current month.");

// One schema for every lançamento, on any account type. Exported because
// the confirmation replays a stored copy of it without the model
// (src/lib/telegram/draft.ts), re-validating it on the way back in.
export const lancamentoInputSchema = z.object({
  confirmed: z
    .boolean()
    .describe("false returns the text to read back; true only after the user agreed."),
  kind: z.enum(["expense", "income"]).default("expense"),
  description: z.string().min(1).max(120),
  amount: z
    .number()
    .positive()
    .describe("Positive; `kind` carries the sign. Full price unless amountIsPerInstallment."),
  account: z.string().describe("Account NAME as the user says it: 'nubank', 'carteira'."),
  category: z.string().describe("Category NAME. Pick the obvious one yourself."),
  card: z.string().optional().describe("Physical card name, only if the user named one."),
  paymentMethod: z
    .enum(debitPaymentMethodValues)
    .default("OTHER")
    .describe(
      "Non-card accounts: 'debito' DEBIT_CARD, 'pix' PIX, 'dinheiro' CASH, 'ted' BANK_TRANSFER, 'boleto' BOLETO.",
    ),
  date: dateSchema.optional(),
  installments: z.number().int().min(1).max(48).default(1).describe("Credit card only."),
  amountIsPerInstallment: z
    .boolean()
    .default(false)
    .describe("true for '4x de 100', false for '400 em 4x'."),
  skipPastInstallments: z
    .boolean()
    .default(false)
    .describe("Old purchase: record only the installments still ahead."),
  person: z.string().optional().describe("Person NAME when it is all theirs and NOT divided."),
  splits: z
    .array(z.object({ person: z.string(), amount: z.number().positive() }))
    .default([])
    .describe(
      "Divided only ('rachei com a Maria'): positive shares summing to `amount`, FIRST is who paid. Empty = not divided.",
    ),
  recurrence: z
    .enum(["none", "daily", "weekly", "monthly"])
    .default("none")
    .describe("'todo mes' monthly, 'toda semana' weekly, 'todo dia' daily. Never with installments."),
  pending: z.boolean().default(false).describe("true when the money has not moved yet."),
});

export type LancamentoInput = z.infer<typeof lancamentoInputSchema>;

// A month's first/last calendar day, as the "yyyy-MM-dd" strings
// effectiveDateWhere expects. `new Date(Date.UTC(...))` with day 0 of the
// next month is the standard last-day trick and stays timezone-free
// because only the digits are ever read back out.
function monthRange(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function currentMonth() {
  return todayCalendarDate().slice(0, 7);
}

// Every tool returns plain JSON-safe values — Prisma `Decimal` and `Date`
// both serialize into shapes a model reads badly ("Decimal(-32.9)", a
// full ISO timestamp for what is really a bare calendar day), so they get
// converted here, once, at this boundary.
function money(value: { toNumber(): number } | null | undefined): number | undefined {
  return value?.toNumber();
}

// Same rule refineDebitTransaction/refineCreditTransaction apply on the
// app's forms: splits are optional, but once present they have to add up
// to the transaction total. The 0.01 tolerance absorbs the rounding of a
// three-way split, exactly as the forms do.
function validateSplits(splits: { amount: number }[], amount: number): string | null {
  if (splits.length === 0) return null;
  const total = splits.reduce((sum, split) => sum + split.amount, 0);
  if (Math.abs(total - amount) > 0.01) {
    return `A divisão soma ${total.toFixed(2)}, mas o lançamento é de ${amount.toFixed(2)} - as partes precisam fechar com o total.`;
  }
  return null;
}

// Category and Person both store `colorStyle` as one of ColorPicker's own
// class strings (see AVAILABLE_COLORS). The model no longer gets to name
// a color — that was a whole palette enum on the prompt of every step, to
// decide something nobody asked it to decide — so the pick is always the
// deterministic hash off the row's own name, which is exactly what an
// omitted color already did. A handful of categories created through the
// bot still don't all come out orange (the concern behind "uma cor por
// categoria em vez de oito repetidas"), and the app can recolor them.
function resolveColorStyle(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return AVAILABLE_COLORS[Math.abs(hash) % AVAILABLE_COLORS.length].class;
}

// Deliberately NOT validated against CATEGORY_ICONS: that module imports
// every Phosphor icon component, and Phosphor's own IconContext calls
// React's createContext, which throws the moment it is pulled into a
// Route Handler's server bundle ("createContext is not a function" at
// build time). Nothing is lost by skipping the check: resolveCategoryIcon
// (src/lib/category-icons.ts) already renders the default tag icon for
// any name it doesn't know, so a half-remembered name behaves exactly
// like no icon at all.
function resolveIconName(icon: string | undefined): string | null {
  const trimmed = icon?.trim();
  return trimmed ? trimmed : null;
}

type ResolvedPerson = { id: string; name: string; isSelf: boolean };

// What the confirmation says about attribution. The user's own "Eu" is
// left out when nothing is divided — it's the default, and a line stating
// it would show up on every single lançamento.
function describePeople(
  person: ResolvedPerson | null,
  splits: { person: ResolvedPerson; amount: number }[],
): { name: string; amount: number | null }[] {
  if (splits.length > 0) {
    return splits.map((split) => ({ name: split.person.name, amount: split.amount }));
  }
  return person && !person.isSelf ? [{ name: person.name, amount: null }] : [];
}

// Resolves and ownership-checks everything the create path needs, from
// names. Every lookup is scoped to `userId`, so a name the model invented
// comes back as a plain "não achei" (with the real ones listed) instead
// of touching somebody else's row.
async function resolveLancamentoContext(userId: string, input: LancamentoInput) {
  const date = input.date ?? todayCalendarDate();

  const [accounts, categories, people] = await Promise.all([
    prisma.account.findMany({
      where: { userId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        type: true,
        creditCardDetails: true,
        cards: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
    // Narrowed by direction so "Salário" can't be matched for an expense,
    // and so the two system-only types (LOAN, CARD_PAYMENT — see
    // CategoryType in prisma/schema.prisma) stay out of reach: those rows
    // belong to the loan and invoice-payment flows, not to something
    // typed into a chat.
    prisma.category.findMany({
      where: {
        OR: [{ userId }, { userId: null }],
        type: { in: input.kind === "income" ? ["INCOME"] : ["EXPENSE", "INVESTMENT"] },
      },
      select: { id: true, name: true, type: true },
    }),
    prisma.person.findMany({
      where: { userId },
      select: { id: true, name: true, isSelf: true },
    }),
  ]);

  // Two accounts really can share a name — a "Nubank" checking account
  // next to a "Nubank" credit card is the normal way to set that bank up
  // — so before asking anything, use what the message already implies:
  // "em 3x" or a named physical card can only be the card, and an
  // explicit payment method ("no débito", "no pix") can only be the other
  // one. Only a message with no such hint gets a question.
  const cardOnly = input.installments > 1 || Boolean(input.card);
  const debitOnly = !cardOnly && input.paymentMethod !== "OTHER";
  const narrowed = accounts.filter((row) =>
    cardOnly
      ? row.type === "CREDIT_CARD"
      : debitOnly
        ? row.type !== "CREDIT_CARD"
        : true,
  );

  const account = resolveNamed(
    // Back to the full list when narrowing leaves nothing: "3x" from a
    // user with no credit card has to fail on the parcelamento rule
    // below, which says why, not on "não achei a conta".
    disambiguate(narrowed.length > 0 ? narrowed : accounts, (row) =>
      labelFor(ACCOUNT_TYPE_LABELS, row.type).toLowerCase(),
    ),
    input.account,
    ACCOUNT_KIND,
  );
  if ("error" in account) return account;

  const category = resolveNamed(
    disambiguate(categories, (row) =>
      labelFor(CATEGORY_TYPE_LABELS, row.type).toLowerCase(),
    ),
    input.category,
    CATEGORY_KIND,
  );
  if ("error" in category) return category;

  // Attribution defaults to the self ("Eu") Person, which every user has
  // from sign-up (src/lib/auth/sync-user.ts) — same default the
  // transaction form applies.
  let person: ResolvedPerson | null = people.find((row) => row.isSelf) ?? null;
  if (input.person) {
    const named = resolveNamed(people, input.person, PERSON_KIND);
    if ("error" in named) return named;
    person = named.match;
  }

  const splits: { person: ResolvedPerson; amount: number }[] = [];
  for (const split of input.splits) {
    const named = resolveNamed(people, split.person, PERSON_KIND);
    if ("error" in named) return named;
    splits.push({ person: named.match, amount: split.amount });
  }

  return {
    account: account.match.row,
    category: category.match.row,
    person,
    splits,
    date,
  };
}

// The write path, split out of the tool wrapper so a confirmation can
// replay it straight from the stored draft — same code, same validation,
// no model involved (src/app/api/telegram/route.ts).
export async function runCreateLancamento(userId: string, input: LancamentoInput) {
  const context = await resolveLancamentoContext(userId, input);
  if ("error" in context) return { error: context.error };
  const { account, category, person, splits, date } = context;

  const isCard = account.type === "CREDIT_CARD";

  if (!isCard && input.installments > 1) {
    return {
      error:
        "Parcelamento só existe em cartão de crédito - nessa conta dá para lançar o valor cheio ou criar uma recorrência.",
    };
  }

  // Same rule refineCreditTransaction enforces on the app's own form: a
  // recurrence generates one charge per date, installments split ONE
  // charge into N - asking for both at once is contradictory, not
  // something to silently pick a winner for.
  if (input.recurrence !== "none" && input.installments > 1) {
    return {
      error:
        "Não dá para combinar recorrência com parcelamento - ou é uma assinatura que se repete, ou é uma compra dividida em parcelas.",
    };
  }

  const splitError = validateSplits(splits, input.amount);
  if (splitError) return { error: splitError };

  let card: { id: string; name: string } | null = null;
  if (isCard) {
    if (!account.creditCardDetails) {
      return {
        error: `O ${account.name} está sem os dados de fechamento e vencimento - configure o cartão no app antes de lançar.`,
      };
    }
    if (account.cards.length === 0) {
      return {
        error: `O ${account.name} não tem nenhum cartão físico ativo - cadastre um no app antes de lançar a compra.`,
      };
    }
    if (input.card) {
      const named = resolveNamed(account.cards, input.card, CARD_KIND);
      if ("error" in named) return named;
      card = named.match;
    } else {
      card = account.cards[0];
    }
  }

  const installmentAmount = input.amountIsPerInstallment
    ? input.amount
    : input.amount / input.installments;
  const total = input.amountIsPerInstallment
    ? input.amount * input.installments
    : input.amount;

  const summary: LancamentoSummary = {
    kindLabel: labelFor(TRANSACTION_KIND_LABELS, input.kind),
    description: input.description,
    amount: total,
    installments: input.installments,
    installmentAmount,
    account: account.name,
    card: card?.name ?? null,
    category: category.name,
    paymentMethodLabel: isCard ? null : labelFor(PAYMENT_METHOD_LABELS, input.paymentMethod),
    date,
    pending: input.pending,
    recurrenceLabel:
      input.recurrence === "none" ? null : labelFor(RECURRENCE_LABELS, input.recurrence),
    people: describePeople(person, splits),
  };

  // Nothing written yet: the resolved draft is parked on the user row so
  // a bare "sim" finishes this without another model turn.
  if (!input.confirmed) {
    await saveDraft(userId, input);
    return { needsConfirmation: true, reply: askToConfirm(summary) };
  }

  const signedAmount =
    (input.kind === "expense" ? -1 : 1) * (isCard ? installmentAmount : total);
  const splitsValue = {
    personId: person?.id ?? "",
    splits: splits.map((split) => ({ personId: split.person.id, amount: split.amount })),
    type: input.kind,
  };
  // Only meaningful for the single-transaction/installment paths below,
  // where the user is telling the bot about ONE specific charge. A
  // recurrence's occurrences are never asked about individually — same
  // as the /recurrences screen's own createRecurrenceOccurrence
  // (recurrences/actions.ts), each one's status is derived from its own
  // date vs. today, not from this flag (see the two recurrence loops
  // below).
  const status = input.pending ? ("PENDING" as const) : ("COMPLETED" as const);
  const startDate = parseCalendarDate(date);
  const todayDate = parseCalendarDate(todayCalendarDate());

  if (!isCard) {
    // A recurrence creates the rule row plus a rolling window of real
    // Transaction rows, exactly like the transactions screen does - so
    // the result shows up on /recurrences and can be extended from there,
    // instead of being a one-off the app can't manage.
    if (input.recurrence !== "none") {
      const windowEnd = recurrenceWindowEnd(startDate);
      const templateSplits = resolveSplitsCreateInput(splitsValue, signedAmount);

      const recurrence = await prisma.recurrence.create({
        data: {
          userId,
          accountId: account.id,
          categoryId: category.id,
          paymentMethod: input.paymentMethod,
          description: input.description,
          amount: signedAmount,
          frequency: input.recurrence.toUpperCase() as "DAILY" | "WEEKLY" | "MONTHLY",
          startDate,
          splits: templateSplits ? { create: templateSplits } : undefined,
        },
      });

      let occurrenceDate = startDate;
      let generated = 0;
      while (occurrenceDate <= windowEnd) {
        await prisma.transaction.create({
          data: {
            userId,
            accountId: account.id,
            categoryId: category.id,
            description: input.description,
            amount: signedAmount,
            date: occurrenceDate,
            // Verified, real bug: this used to be the flat `status`
            // above for every occurrence, so a recurrence whose first
            // charge was already paid got its whole 12-month generated
            // window stamped COMPLETED, including occurrences a year
            // out — future ones must be PENDING regardless of the
            // first one's own paid/pending state.
            status: occurrenceDate <= todayDate ? "COMPLETED" : "PENDING",
            paymentMethod: input.paymentMethod,
            recurrenceId: recurrence.id,
            splits: templateSplits ? { create: templateSplits } : undefined,
          },
        });
        generated++;
        occurrenceDate = stepDate(occurrenceDate, input.recurrence);
      }

      revalidateAfterWrite();
      return { created: true, reply: confirmedLancamento(summary, { generated }) };
    }

    const splitsCreateInput = resolveSplitsCreateInput(splitsValue, signedAmount);

    await prisma.transaction.create({
      data: {
        userId,
        accountId: account.id,
        categoryId: category.id,
        description: input.description,
        amount: signedAmount,
        date: startDate,
        status,
        paymentMethod: input.paymentMethod,
        splits: splitsCreateInput ? { create: splitsCreateInput } : undefined,
      },
    });

    revalidateAfterWrite();
    return { created: true, reply: confirmedLancamento(summary) };
  }

  // --- credit card from here down; both were checked above ---
  const cardDetails = account.creditCardDetails!;
  const physicalCard = card!;

  // Creates one Transaction row plus its card/invoice joins, and reports
  // where the cursor lands next so the following charge falls into the
  // NEXT billing cycle. Mirrors createCreditTransactionRow in
  // transactions/actions.ts.
  const createRow = async (params: {
    amount: number;
    date: Date;
    cursorDate: Date;
    installmentGroupId?: string;
    installmentNumber?: number;
    installmentCount?: number;
    recurrenceId?: string;
    // Defaults to the flat `status` above (the single-transaction/
    // installment callers' own paid/pending answer) — the recurrence
    // loop below overrides this per occurrence instead, since only IT
    // knows each occurrence's own date.
    status?: "PENDING" | "COMPLETED";
  }) => {
    const rowSplits = resolveSplitsCreateInput(splitsValue, params.amount);

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        accountId: account.id,
        categoryId: category.id,
        description: input.description,
        amount: params.amount,
        date: params.date,
        status: params.status ?? status,
        installmentGroupId: params.installmentGroupId,
        installmentNumber: params.installmentNumber,
        installmentCount: params.installmentCount,
        recurrenceId: params.recurrenceId,
        splits: rowSplits ? { create: rowSplits } : undefined,
      },
    });

    const invoice = await resolveInvoiceForDate(account.id, params.cursorDate, cardDetails);
    await prisma.transactionInvoice.create({
      data: { transactionId: transaction.id, invoiceId: invoice.id },
    });
    await prisma.transactionCard.create({
      data: { transactionId: transaction.id, cardId: physicalCard.id },
    });

    // Advance past this cycle's closing day. +1 day off the freshly
    // computed (not DB-read) closing date - see createCreditTransactionRow
    // in transactions/actions.ts for why both of those matter.
    return {
      invoiceDueDate: dateOnlyKey(invoice.dueDate),
      nextCursorDate: fromAppZoned(
        addDays(toAppZoned(computeInvoiceCycle(params.cursorDate, cardDetails).closingDate), 1),
      ),
    };
  };

  if (input.recurrence !== "none") {
    const windowEnd = recurrenceWindowEnd(startDate);
    const templateSplits = resolveSplitsCreateInput(splitsValue, signedAmount);

    const recurrence = await prisma.recurrence.create({
      data: {
        userId,
        accountId: account.id,
        cardId: physicalCard.id,
        categoryId: category.id,
        description: input.description,
        amount: signedAmount,
        frequency: input.recurrence.toUpperCase() as "DAILY" | "WEEKLY" | "MONTHLY",
        startDate,
        splits: templateSplits ? { create: templateSplits } : undefined,
      },
    });

    let occurrenceDate = startDate;
    let generated = 0;
    while (occurrenceDate <= windowEnd) {
      await createRow({
        amount: signedAmount,
        date: occurrenceDate,
        cursorDate: occurrenceDate,
        recurrenceId: recurrence.id,
        // Same fix as the debit recurrence loop above: each occurrence's
        // status follows its own date vs. today, not the flat `status`
        // (which used to stamp every future occurrence COMPLETED
        // whenever the first charge was already paid).
        status: occurrenceDate <= todayDate ? "COMPLETED" : "PENDING",
      });
      generated++;
      occurrenceDate = stepDate(occurrenceDate, input.recurrence);
    }

    revalidateAfterWrite();
    return { created: true, reply: confirmedLancamento(summary, { generated }) };
  }

  const installmentGroupId = input.installments > 1 ? crypto.randomUUID() : undefined;
  let cursorDate = startDate;
  const invoiceDueDates: string[] = [];

  for (let index = 0; index < input.installments; index++) {
    // DB-free peek at this installment's cycle, only to decide whether to
    // skip it and still advance the cursor correctly - a skipped
    // installment never touches (or creates) an Invoice.
    const peekCycle = computeInvoiceCycle(cursorDate, cardDetails);
    if (input.skipPastInstallments && peekCycle.dueDate < todayDate) {
      cursorDate = fromAppZoned(addDays(toAppZoned(peekCycle.closingDate), 1));
      continue;
    }

    const result = await createRow({
      amount: signedAmount,
      date: fromAppZoned(addMonths(toAppZoned(startDate), index)),
      cursorDate,
      installmentGroupId,
      installmentNumber: installmentGroupId ? index + 1 : undefined,
      installmentCount: installmentGroupId ? input.installments : undefined,
    });
    invoiceDueDates.push(result.invoiceDueDate);
    cursorDate = result.nextCursorDate;
  }

  if (invoiceDueDates.length === 0) {
    return {
      error:
        "Todas as parcelas já venceram - não registrei nada. Refaça sem pular as parcelas passadas se quiser lançar a compra inteira.",
    };
  }

  revalidateAfterWrite();
  return { created: true, reply: confirmedLancamento(summary, { invoiceDueDates }) };
}

export function createFiSyncTools(userId: string) {
  return {
    listAccounts: tool({
      description: "Accounts with balance (credit cards report limit instead).",
      inputSchema: z.object({}),
      execute: async () => {
        const todayDate = parseCalendarDate(todayCalendarDate());

        const [accounts, sums] = await Promise.all([
          prisma.account.findMany({
            where: { userId, status: "ACTIVE" },
            orderBy: [{ type: "asc" }, { name: "asc" }],
            include: {
              creditCardDetails: true,
              cards: { where: { status: "ACTIVE" }, select: { name: true } },
            },
          }),
          // Balance is never a stored column (see prisma/schema.prisma) —
          // it's the sum of every transaction up to today. Future-dated
          // rows generated by a recurrence must not count, same rule
          // accounts/actions.ts's listAccounts follows.
          prisma.transaction.groupBy({
            by: ["accountId"],
            where: { userId, date: { lte: todayDate } },
            _sum: { amount: true },
          }),
        ]);

        const balanceByAccountId = new Map(
          sums.map((sum) => [sum.accountId, sum._sum.amount?.toNumber() ?? 0]),
        );

        // Every `undefined` here is dropped from the JSON the model sees:
        // an absent key costs nothing, a null costs a few tokens on every
        // remaining step of the turn.
        return accounts.map((account) => ({
          name: account.name,
          type: labelFor(ACCOUNT_TYPE_LABELS, account.type),
          balance:
            account.type === "CREDIT_CARD"
              ? undefined
              : (balanceByAccountId.get(account.id) ?? 0),
          limit: money(account.creditCardDetails?.limit),
          closingDay: account.creditCardDetails?.closingDay ?? undefined,
          dueDay: account.creditCardDetails?.dueDay ?? undefined,
          // Only worth naming when there's a choice to make — one card
          // per account is the normal case and needs no listing.
          cards: account.cards.length > 1 ? account.cards.map((card) => card.name) : undefined,
        }));
      },
    }),

    listCategories: tool({
      description: "Category names, grouped by type.",
      inputSchema: z.object({}),
      execute: async () => {
        const categories = await prisma.category.findMany({
          where: { OR: [{ userId }, { userId: null }] },
          orderBy: [{ type: "asc" }, { name: "asc" }],
          select: { name: true, type: true },
        });

        // Grouped names instead of one object per row: the same
        // information for about a third of the tokens (35 seeded
        // categories used to arrive as 35 objects carrying an id nobody
        // needs), and the group key is already the pt-BR word.
        const byType: Record<string, string[]> = {};
        for (const category of categories) {
          const label = labelFor(CATEGORY_TYPE_LABELS, category.type);
          (byType[label] ??= []).push(category.name);
        }
        return byType;
      },
    }),

    listPeople: tool({
      description:
        "People the user splits with, with the running balance (positive = user owes them).",
      inputSchema: z.object({}),
      execute: async () => {
        const todayDate = parseCalendarDate(todayCalendarDate());

        const [people, balances] = await Promise.all([
          prisma.person.findMany({
            where: { userId },
            orderBy: [{ isSelf: "desc" }, { name: "asc" }],
            select: { id: true, name: true, isSelf: true },
          }),
          // Same figure (and same reasoning) as the /people screen's own
          // list: cash splits settle immediately, and a card purchase
          // only enters the balance once its invoice is actually paid —
          // which happens through this very query, since paying an
          // invoice posts the settlement expense on a non-card account
          // carrying one negative split per person. Adding a second term
          // for those settlements is what once counted every invoice
          // payment twice (see listPeople in people/actions.ts).
          // Future-dated PENDING rows from a recurrence are excluded for
          // the same reason every other balance in the app excludes them.
          prisma.transactionSplit.groupBy({
            by: ["personId"],
            where: {
              transaction: {
                userId,
                account: { type: { not: "CREDIT_CARD" } },
                date: { lte: todayDate },
              },
            },
            _sum: { amount: true },
          }),
        ]);

        const balanceByPersonId = new Map(
          balances.map((row) => [row.personId, row._sum.amount?.toNumber() ?? 0]),
        );

        return people.map((person) => ({
          name: person.isSelf ? `${person.name} (você)` : person.name,
          // Positive = the user owes this person; negative = this person
          // owes the user. Same convention as the /people screen.
          balance: balanceByPersonId.get(person.id) ?? 0,
        }));
      },
    }),

    listTransactions: tool({
      description:
        "Transactions, newest first. Negative = expense. Card purchases fall in the month their invoice is DUE.",
      inputSchema: z.object({
        from: dateSchema.optional(),
        to: dateSchema.optional(),
        account: z.string().optional().describe("Account name."),
        category: z.string().optional().describe("Category name."),
        search: z.string().optional().describe("Matches the description."),
        limit: z.number().int().min(1).max(MAX_ROWS).default(10),
      }),
      execute: async ({ from, to, account, category, search, limit }) => {
        const filter = await resolveListFilter(userId, account, category);
        if ("error" in filter) return filter;

        const transactions = await prisma.transaction.findMany({
          where: {
            userId,
            ...(filter.accountId ? { accountId: filter.accountId } : {}),
            ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
            ...(search
              ? { description: { contains: search, mode: "insensitive" as const } }
              : {}),
            ...effectiveDateWhere(from, to),
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: limit,
          include: {
            account: { select: { name: true } },
            category: { select: { name: true } },
          },
        });

        return transactions.map((transaction) => ({
          date: dateOnlyKey(transaction.date),
          description: transaction.description,
          amount: transaction.amount.toNumber(),
          account: transaction.account.name,
          category: transaction.category?.name ?? undefined,
          // Only the exceptional status is worth a key — "Concluído" on
          // every row of every list is pure prompt weight.
          status:
            transaction.status === "COMPLETED"
              ? undefined
              : labelFor(TRANSACTION_STATUS_LABELS, transaction.status),
          installment:
            transaction.installmentCount && transaction.installmentNumber
              ? `${transaction.installmentNumber}/${transaction.installmentCount}`
              : undefined,
        }));
      },
    }),

    monthSummary: tool({
      description:
        "One month's income, expenses, net and expense breakdown by category. Use for 'quanto gastei', 'em que gastei mais'.",
      inputSchema: z.object({
        month: monthSchema.optional(),
      }),
      execute: async ({ month }) => {
        const target = month ?? currentMonth();
        const { from, to } = monthRange(target);
        const where = { userId, ...effectiveDateWhere(from, to) };

        const [byCategory, categories] = await Promise.all([
          prisma.transaction.groupBy({
            by: ["categoryId"],
            where,
            _sum: { amount: true },
          }),
          prisma.category.findMany({
            where: { OR: [{ userId }, { userId: null }] },
            select: { id: true, name: true },
          }),
        ]);

        const nameById = new Map(categories.map((category) => [category.id, category.name]));

        let income = 0;
        let expense = 0;
        const expensesByCategory: { category: string; total: number }[] = [];

        for (const row of byCategory) {
          const total = row._sum.amount?.toNumber() ?? 0;
          if (total >= 0) {
            income += total;
          } else {
            expense += total;
            expensesByCategory.push({
              category: row.categoryId
                ? (nameById.get(row.categoryId) ?? row.categoryId)
                : "Sem categoria",
              total: Math.abs(total),
            });
          }
        }

        expensesByCategory.sort((a, b) => b.total - a.total);

        return {
          month: target,
          income,
          expense: Math.abs(expense),
          net: income + expense,
          expensesByCategory,
        };
      },
    }),

    listInvoices: tool({
      description: "Credit-card invoices: total, paid and remaining. Use for 'quanto ta a fatura'.",
      inputSchema: z.object({
        account: z.string().optional().describe("Card account name."),
        onlyUnpaid: z.boolean().default(true).describe("Only invoices still owing."),
        limit: z.number().int().min(1).max(MAX_ROWS).default(6),
      }),
      execute: async ({ account, onlyUnpaid, limit }) => {
        const filter = await resolveListFilter(userId, account, undefined);
        if ("error" in filter) return filter;

        const invoices = await prisma.invoice.findMany({
          where: {
            account: { userId, type: "CREDIT_CARD" },
            ...(filter.accountId ? { accountId: filter.accountId } : {}),
          },
          include: {
            account: { select: { name: true } },
            transactionInvoices: { include: { transaction: { select: { amount: true } } } },
            creditsReceived: { select: { amount: true } },
          },
          orderBy: { dueDate: "desc" },
          take: onlyUnpaid ? MAX_ROWS : limit,
        });

        const mapped = invoices.map((invoice) => {
          const total = sumInvoiceTransactionsTotal(invoice.transactionInvoices);
          const paid = invoice.paidAmount?.toNumber() ?? 0;
          const creditApplied = invoice.creditsReceived.reduce(
            (sum, credit) => sum + credit.amount.toNumber(),
            0,
          );
          return {
            account: invoice.account.name,
            closingDate: dateOnlyKey(invoice.closingDate),
            dueDate: dateOnlyKey(invoice.dueDate),
            total,
            paid,
            remainingDue: Math.max(0, total - paid - creditApplied),
            transactionCount: invoice.transactionInvoices.length,
          };
        });

        return (onlyUnpaid ? mapped.filter((invoice) => invoice.remainingDue > 0) : mapped).slice(
          0,
          limit,
        );
      },
    }),

    createCategory: tool({
      description:
        "Create a category. Reuse an existing one whenever it fits — near-duplicates are worse than a rough match. confirmed=true only after the user agrees.",
      inputSchema: z.object({
        confirmed: z.boolean(),
        name: z.string().min(1).max(40),
        // LOAN and CARD_PAYMENT are system-only (see CategoryType in
        // prisma/schema.prisma) and are left out of the app's own type
        // picker too — the bot must not be able to mint one either.
        type: z.enum(["EXPENSE", "INCOME", "INVESTMENT"]),
        icon: z
          .string()
          .optional()
          .describe("Phosphor name: ForkKnife, ShoppingCart, House, Car, Heartbeat, Money."),
      }),
      execute: async (input) => {
        const name = input.name.trim();

        // Case-insensitive, and across system categories too — the seeded
        // set already covers most of what a user asks for, and a second
        // "Alimentação" sitting next to the built-in one splits every
        // report that groups by category.
        const existing = await prisma.category.findFirst({
          where: {
            OR: [{ userId }, { userId: null }],
            type: input.type,
            name: { equals: name, mode: "insensitive" },
          },
          select: { name: true },
        });
        if (existing) return { alreadyExists: true, name: existing.name };

        if (!input.confirmed) {
          return {
            needsConfirmation: true,
            name,
            type: labelFor(CATEGORY_TYPE_LABELS, input.type),
          };
        }

        const category = await prisma.category.create({
          data: {
            userId,
            name,
            type: input.type,
            colorStyle: resolveColorStyle(name),
            icon: resolveIconName(input.icon),
          },
          select: { name: true },
        });

        revalidatePath("/categories");
        revalidateAfterWrite();
        return { created: true, name: category.name };
      },
    }),

    createPerson: tool({
      description: "Create a person to split with. confirmed=true only after the user agrees.",
      inputSchema: z.object({
        confirmed: z.boolean(),
        name: z.string().min(1).max(40).describe("Just the name: 'Maria', 'mae'."),
      }),
      execute: async (input) => {
        // Same normalization createPerson (people/actions.ts) applies, so
        // a name typed in a hurry through chat lands stored exactly as it
        // would through the app's form ("mae" -> "Mãe").
        const name = formatPersonName(input.name);

        const existing = await prisma.person.findFirst({
          where: { userId, name: { equals: name, mode: "insensitive" } },
          select: { name: true },
        });
        if (existing) return { alreadyExists: true, name: existing.name };

        if (!input.confirmed) return { needsConfirmation: true, name };

        // `isSelf` is deliberately never settable here: every user gets
        // exactly one self Person at sign-up (src/lib/auth/sync-user.ts)
        // and it can't be reassigned from the app either.
        const person = await prisma.person.create({
          data: { userId, name, colorStyle: resolveColorStyle(name) },
          select: { name: true },
        });

        revalidatePath("/people");
        revalidateAfterWrite();
        return { created: true, name: person.name };
      },
    }),

    createTransaction: tool({
      description:
        "Record an expense/income on any account, credit card included (installments, splits and recurrence all live here). Call with confirmed=false first: it returns the exact text to send back.",
      inputSchema: lancamentoInputSchema,
      execute: (input) => runCreateLancamento(userId, input),
    }),
  };
}

// Name -> id for the read tools' optional filters. An unresolvable name
// comes back as the same "não achei / qual delas?" question the create
// path asks, instead of silently listing everything.
async function resolveListFilter(
  userId: string,
  account: string | undefined,
  category: string | undefined,
): Promise<{ accountId?: string; categoryId?: string; error?: never } | { error: string }> {
  const filter: { accountId?: string; categoryId?: string } = {};

  if (account) {
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true, name: true, type: true },
    });
    const match = resolveNamed(
      disambiguate(accounts, (row) => labelFor(ACCOUNT_TYPE_LABELS, row.type).toLowerCase()),
      account,
      ACCOUNT_KIND,
    );
    if ("error" in match) return match;
    filter.accountId = match.match.row.id;
  }

  if (category) {
    const categories = await prisma.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      select: { id: true, name: true, type: true },
    });
    const match = resolveNamed(
      disambiguate(categories, (row) => labelFor(CATEGORY_TYPE_LABELS, row.type).toLowerCase()),
      category,
      CATEGORY_KIND,
    );
    if ("error" in match) return match;
    filter.categoryId = match.match.row.id;
  }

  return filter;
}

// The bot writes the same rows the screens do, so the same cached pages
// have to be dropped — otherwise a transaction added from Telegram only
// shows up in the browser after a hard refresh.
function revalidateAfterWrite() {
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/invoices");
  revalidatePath("/cards");
  revalidatePath("/people");
  revalidatePath("/projections");
  revalidatePath("/");
}
