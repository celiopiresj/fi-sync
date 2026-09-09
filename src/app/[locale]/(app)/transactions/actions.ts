"use server";

import { addDays, addMonths } from "date-fns";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth/server";
import {
  parseCalendarDate,
  toAppZoned,
  fromAppZoned,
  todayCalendarDate,
} from "@/lib/date";
import {
  computeInvoiceCycle,
  computeCurrentInvoiceCycle,
  resolveInvoiceForDate,
} from "@/lib/invoice-resolution";
// Shared by every list/aggregate query filtered by period here
// (listTransactions, getTransactionById, getMonthlyBalances,
// getCategoryExpenseBreakdown) and by the Telegram bot's own reads — see
// the note in that file for why it isn't local to this screen anymore.
import { effectiveDateWhere } from "@/lib/transaction-period";
import { resolveSplitsCreateInput } from "@/lib/transaction-splits";
import {
  RECURRENCE_GENERATION_WINDOW_MONTHS,
  stepDate,
} from "@/lib/recurrence-window";
import { recomputeInvoiceStatus } from "@/lib/invoice-total";
import { parseStatement } from "@/lib/statement-import/parse";
import {
  ACCEPTED_IMPORT_MEDIA_TYPES,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_FILE_MB,
  statementSourceKindValues,
  type StatementEntry,
  type StatementSourceKind,
} from "@/lib/statement-import/schema";
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
  type DebitTransactionFormValues,
  type DebitTransactionValues,
  type CreditTransactionFormValues,
  type CreditTransactionValues,
} from "./_schema/schema";
import { periodRange, shiftPeriod, type Period } from "./_lib/period";
import { formatMonthAbbreviationPtBr } from "./_lib/format-month-label";
import {
  ALL_CARDS_ACCOUNT_FILTER,
  ALL_NON_CARD_ACCOUNTS_FILTER,
} from "./_constants/constants";

// Resolves the "Conta" filter's value — a real account id, or one of the
// two group sentinels from _constants/constants.ts (every card / every
// non-card account) — to the Prisma where-clause fragment it should
// apply. Shared by every list/aggregate query filtered by this same
// value (listTransactions, getCategoryExpenseBreakdown,
// getMonthlyBalances) so the three don't drift on how they interpret it.
function accountFilterWhere(accountId: string | undefined): Record<string, unknown> {
  if (accountId === ALL_CARDS_ACCOUNT_FILTER) {
    return { account: { type: "CREDIT_CARD" } };
  }
  if (accountId === ALL_NON_CARD_ACCOUNTS_FILTER) {
    return { account: { type: { not: "CREDIT_CARD" } } };
  }
  if (accountId) {
    return { accountId };
  }
  return {};
}

// The "at least one of these" OR condition for narrowing a query down to
// one Person's transactions — an unattributed row (no splits at all) is
// implicitly the user's own (same convention transactions/columns.tsx's
// `selfLabel` fallback and projections/_lib/self-share.ts both rely on),
// so filtering by the Person marked isSelf has to match those rows too,
// not just ones with an explicit split naming them. Shared by
// listTransactions and getCategoryExpenseBreakdown so this subtle rule
// can't drift between the two.
async function personFilterCondition(userId: string, personId: string) {
  const person = await prisma.person.findUnique({
    where: { id: personId, userId },
    select: { isSelf: true },
  });
  return {
    OR: person?.isSelf
      ? [{ splits: { some: { personId } } }, { splits: { none: {} } }]
      : [{ splits: { some: { personId } } }],
  };
}

// Lets the search box also find a transaction by its amount, typed the
// same comma-decimal way as every AmountInput in this app ("184,90" or
// "184.90") — parsed once here and reused by every query filtered by
// `search` (listTransactions, getCategoryExpenseBreakdown) so the two
// can't drift on what counts as a numeric search. `null` for anything
// that isn't a plain signed decimal (an ordinary text search term falls
// through to just the description match).
function parseSearchAmount(search: string): number | null {
  const normalized = search.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// A new transaction/batch row always defaults to the self ("Eu") Person
// — every user has exactly one, created at sign-up and permanent
// (sync-user.ts, people/actions.ts), so this is never "guessed" from
// usage history anymore. Returns null only in the till-first-login
// window before that seed has run (shouldn't be reachable from an
// authenticated route, but kept graceful rather than assumed).
async function computeDefaultPersonId(userId: string) {
  const self = await prisma.person.findFirst({
    where: { userId, isSelf: true },
    select: { id: true },
  });
  return self?.id ?? null;
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

  const defaultPersonId = await computeDefaultPersonId(userId);

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

  const where: Record<string, unknown> = { userId, ...accountFilterWhere(filters.accountId) };
  // Independent "at least one of these" conditions (personId's own OR,
  // effectiveDateWhere's own OR) can't both be assigned to `where.OR`
  // directly — the second would silently clobber the first. Collected
  // here and AND-ed together at the end instead.
  const andConditions: Record<string, unknown>[] = [];

  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.personId) {
    andConditions.push(await personFilterCondition(userId, filters.personId));
  }
  if (filters.search) {
    // Matches the description as before, plus either sign of the typed
    // amount when it parses as one — a search doesn't know whether the
    // row it's looking for is an income or an expense, so "184,90" has
    // to find both a -184.90 expense and a +184.90 income.
    const searchAmount = parseSearchAmount(filters.search);
    andConditions.push({
      OR: [
        { description: { contains: filters.search, mode: "insensitive" } },
        ...(searchAmount !== null
          ? [{ amount: searchAmount }, { amount: -searchAmount }]
          : []),
      ],
    });
  }
  if (filters.from || filters.to) {
    andConditions.push(effectiveDateWhere(filters.from, filters.to));
  }
  if (filters.type === "income") where.amount = { gt: 0 };
  if (filters.type === "expenses") where.amount = { lt: 0 };
  if (andConditions.length > 0) where.AND = andConditions;

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      account: { select: { id: true, name: true, type: true } },
      category: { select: { id: true, name: true, icon: true, colorStyle: true } },
      splits: { include: { person: { select: { id: true, name: true } } } },
      // Only ever set for a credit-card purchase (tasks/015.md) — used by
      // the table/mobile list to show which physical card was used, and
      // by the credit form to prefill `cardId` when editing.
      transactionCard: {
        include: { card: { select: { id: true, name: true, lastFourDigits: true } } },
      },
      // Only ever set for a credit-card purchase — its invoice's dueDate
      // is what `effectiveDate` below resolves to for that row.
      transactionInvoice: {
        include: { invoice: { select: { dueDate: true } } },
      },
    },
    orderBy: { date: "desc" },
  });

  // Decimal isn't a plain serializable value across the Server
  // Action/Client Component boundary — convert once here instead of at
  // every call site. `effectiveDate` is what the UI actually sorts/
  // groups/filters-by-period on (see effectiveDateWhere above) — the
  // transaction's own `date` stays on the row too, shown as the real
  // purchase date in a credit row's own subtitle. Re-sorted by
  // `effectiveDate` in JS after mapping, since Prisma can't express "sort
  // by date, except by a joined table's date for some rows" in a single
  // `orderBy` — the list is one month's worth of rows at a time, small
  // enough that this costs nothing measurable.
  return transactions
    .map((transaction) => ({
      ...transaction,
      amount: transaction.amount.toNumber(),
      effectiveDate:
        transaction.account.type === "CREDIT_CARD" && transaction.transactionInvoice
          ? transaction.transactionInvoice.invoice.dueDate
          : transaction.date,
      splits: transaction.splits.map((split) => ({
        ...split,
        amount: split.amount.toNumber(),
      })),
    }))
    .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime());
}

// Single-row counterpart of listTransactions above — same `include`/
// Decimal-to-number mapping, returning the exact `TransactionRow` shape
// CreditTransactionForm's toFormValues (and DebitTransactionForm's own)
// expect as `prefill`. Exported (rather than kept route-local) so the
// invoices route's own purchase-editing flow can open the same edit
// sheet this route uses — duplicating updateCreditTransaction's
// installment-conversion logic there wasn't worth the self-containment
// convention's usual per-route duplication, unlike the small pure
// queries/helpers that convention is meant for.
export async function getTransactionById(id: string) {
  const userId = await requireUserId();

  const transaction = await prisma.transaction.findUnique({
    where: { id, userId },
    include: {
      account: { select: { id: true, name: true, type: true } },
      category: { select: { id: true, name: true, icon: true, colorStyle: true } },
      splits: { include: { person: { select: { id: true, name: true } } } },
      transactionCard: {
        include: { card: { select: { id: true, name: true, lastFourDigits: true } } },
      },
      transactionInvoice: {
        include: { invoice: { select: { dueDate: true } } },
      },
    },
  });
  if (!transaction) return null;

  return {
    ...transaction,
    amount: transaction.amount.toNumber(),
    // Same effectiveDate as listTransactions — kept structurally
    // consistent with TransactionRow even though this row's own edit
    // form doesn't render it, since callers type this return as
    // TransactionRow (see CreditTransactionSheet's prefill prop).
    effectiveDate:
      transaction.account.type === "CREDIT_CARD" && transaction.transactionInvoice
        ? transaction.transactionInvoice.invoice.dueDate
        : transaction.date,
    splits: transaction.splits.map((split) => ({
      ...split,
      amount: split.amount.toNumber(),
    })),
  };
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
          ...accountFilterWhere(accountId),
          ...effectiveDateWhere(from, to),
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

export type CategoryBreakdownItem = {
  id: string;
  name: string;
  total: number;
  // null for the synthetic "uncategorized" bucket — a real Category can
  // still have either field null (both are optional on that model), so
  // this isn't itself a signal of "uncategorized" to a caller; check
  // `id === "uncategorized"` for that.
  icon: string | null;
  colorStyle: string | null;
  transactionsCount: number;
};
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
  _count: { _all: number };
};

export async function getCategoryExpenseBreakdown(
  filters: Pick<
    TransactionFilters,
    "accountId" | "categoryId" | "personId" | "search" | "from" | "to"
  > = {},
): Promise<CategoryBreakdown> {
  const userId = await requireUserId();

  const where: Record<string, unknown> = {
    userId,
    amount: { lt: 0 },
    ...accountFilterWhere(filters.accountId),
    // Unlike getHomeOverview's own categoryBreakdown query ((home)/
    // actions.ts), which sums every account together and so has to
    // exclude a paid invoice's settlement leg to avoid counting it
    // twice, this screen keeps Débito and Crédito on separate tabs
    // (accountId is always one of the two group sentinels below) — the
    // settlement expense (Débito) and the purchases it paid off
    // (Crédito) never appear in the same total here, so there's nothing
    // to double-count and the settlement stays in.
  };
  // Independent "at least one of these" conditions (the search's own OR,
  // effectiveDateWhere's own OR) can't both be assigned to `where.OR`
  // directly — the second would silently clobber the first. Collected
  // here and AND-ed together at the end instead — same reasoning as
  // listTransactions' own `andConditions` above.
  const andConditions: Record<string, unknown>[] = [];

  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.personId) {
    andConditions.push(await personFilterCondition(userId, filters.personId));
  }
  if (filters.search) {
    // Every row here is already an expense (amount: { lt: 0 } above), so
    // only the negative counterpart of a typed amount can ever match —
    // see listTransactions' own comment for why a plain search checks
    // both signs.
    const searchAmount = parseSearchAmount(filters.search);
    andConditions.push({
      OR: [
        { description: { contains: filters.search, mode: "insensitive" } },
        ...(searchAmount !== null ? [{ amount: -Math.abs(searchAmount) }] : []),
      ],
    });
  }
  if (filters.from || filters.to) {
    andConditions.push(effectiveDateWhere(filters.from, filters.to));
  }
  if (andConditions.length > 0) where.AND = andConditions;

  // { total, count } per category, keyed by categoryId (or
  // "uncategorized") — built one of two ways depending on whether a
  // person filter is active, then fed into the same name/icon/colorStyle
  // resolution and item-shaping below regardless of which path built it.
  let totalsByCategory: Map<string, { total: number; count: number }>;

  if (filters.personId) {
    // A category's SPLIT total isn't a plain sum of `amount` once a
    // person filter narrows it down — a R$300 dinner split 3 ways is
    // R$300 toward "Alimentação" for the category as a whole, but only
    // ~R$100 of it is any one person's own share. Prisma's `groupBy`
    // can't group by a joined field (`transaction.categoryId` isn't a
    // TransactionSplit column), so this path fetches the already-
    // filtered transactions with just this person's own split included
    // and buckets by hand instead of asking the database to sum the
    // whole row. A person's worth of one month's transactions is small
    // enough for this — same "one query, then bucket in JS" tradeoff
    // budgets' own getBudgetWithSpending already makes for a comparable
    // amount of data.
    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        categoryId: true,
        amount: true,
        splits: { where: { personId: filters.personId }, select: { amount: true } },
      },
    });

    totalsByCategory = new Map();
    for (const transaction of transactions) {
      // `personFilterCondition` above only ever lets a transaction
      // through here in one of two shapes: it carries an explicit split
      // for this exact person (whose own `amount` is already scaled to
      // this row's real total, see resolveSplitsCreateInput), or — only
      // when the filtered person is `isSelf` — it carries no splits at
      // all, which is implicitly 100% theirs (same convention this
      // screen's uncategorized bucket, and every other self-share read
      // in this app, follows — see projections/_lib/self-share.ts).
      // Either way, at most one split can match (personId is unique per
      // transaction, see TransactionSplit's own @@unique), so [0] is safe.
      const share = transaction.splits[0]?.amount.toNumber() ?? transaction.amount.toNumber();
      const key = transaction.categoryId ?? "uncategorized";
      const bucket = totalsByCategory.get(key) ?? { total: 0, count: 0 };
      bucket.total += Math.abs(share);
      bucket.count += 1;
      totalsByCategory.set(key, bucket);
    }
  } else {
    // No `: CategoryGroupRow[]` annotation here (unlike the `.map`/
    // `.filter` callbacks below, which keep theirs) — Prisma's `groupBy`
    // overload resolves `T` partly by unifying the call's OWN return
    // type against whatever the call site expects, so a contextual
    // array type here constrains the args themselves and breaks
    // inference (surfaced as a baffling "missing length/pop/push/
    // concat..." error). Left to infer its real (richer) Prisma payload
    // type instead; that type is a structural superset of
    // CategoryGroupRow, so `(group: CategoryGroupRow) => ...` below
    // still type-checks against it.
    const grouped = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });
    totalsByCategory = new Map(
      grouped.map((group: CategoryGroupRow): [string, { total: number; count: number }] => [
        group.categoryId ?? "uncategorized",
        {
          total: Math.abs(group._sum.amount?.toNumber() ?? 0),
          count: group._count._all,
        },
      ]),
    );
  }

  const categoryIds = [...totalsByCategory.keys()].filter((id) => id !== "uncategorized");
  // Explicit type for the same reason as CategoryGroupRow above: without
  // it, `categories` resolves to `any` (the unresolvable generated Prisma
  // client), which makes `new Map(categories.map(...))` below infer
  // `Map<unknown, unknown>` instead of `Map<string, {...}>` — and
  // `Map<unknown,...>.get(...) ?? ...` collapses to TypeScript's `{}`
  // type rather than the real shape.
  const categories: {
    id: string;
    name: string;
    icon: string | null;
    colorStyle: string | null;
  }[] = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, icon: true, colorStyle: true },
      })
    : [];
  const categoryById = new Map(
    categories.map((category): [string, (typeof categories)[number]] => [
      category.id,
      category,
    ]),
  );

  const t = await getTranslations("scrn-transactions");

  const uncategorizedLabel: string = t("chart.byCategory.uncategorized");

  const items = [...totalsByCategory.entries()]
    .map(([id, { total, count }]): CategoryBreakdownItem => {
      const category = id !== "uncategorized" ? categoryById.get(id) : undefined;
      return {
        id,
        name: category?.name ?? uncategorizedLabel,
        total,
        icon: category?.icon ?? null,
        colorStyle: category?.colorStyle ?? null,
        transactionsCount: count,
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

  // Exact match on the deterministic cycle for fromDate — not "the
  // nearest invoice that exists on or after fromDate" (see the identical
  // fix + comment on resolveInvoiceForDate, src/lib/invoice-resolution.ts,
  // for why a ">=" search silently skips over gap months).
  const { closingDate, dueDate } = computeInvoiceCycle(fromDate, account.creditCardDetails);
  const existing = await prisma.invoice.findUnique({
    where: { accountId_closingDate: { accountId, closingDate } },
  });

  if (existing) {
    return {
      closingDate: existing.closingDate,
      dueDate: existing.dueDate,
      existing: true,
    };
  }

  return { closingDate, dueDate, existing: false };
}

// Read-only "which invoice is the CURRENT one" for the credit form's
// installment-position hint (see fields.invoicePreview.currentInstallment)
// — the most recently CLOSED statement, or one closing today, matching
// how "fatura atual" is used colloquially (the one due soon, that you'd
// currently be paying off) rather than the still-open one accumulating
// new purchases (computeInvoiceCycle/previewInvoiceCycle above answer
// THAT question instead — "where would a new purchase land").
export async function previewCurrentInvoiceCycle(accountId: string) {
  const userId = await requireUserId();
  if (!accountId) return null;

  const account = await prisma.account.findUnique({
    where: { id: accountId, userId },
    include: { creditCardDetails: true },
  });
  if (!account?.creditCardDetails) return null;

  const todayDate = parseCalendarDate(todayCalendarDate());
  const { closingDate, dueDate } = computeCurrentInvoiceCycle(
    todayDate,
    account.creditCardDetails,
  );
  const existing = await prisma.invoice.findUnique({
    where: { accountId_closingDate: { accountId, closingDate } },
  });

  if (existing) {
    return { closingDate: existing.closingDate, dueDate: existing.dueDate };
  }

  return { closingDate, dueDate };
}

// Read-only preview of every installment's invoice cycle for a would-be
// purchase — walks the same cursor-advance sequence createCreditTransaction's
// installment loop uses (each installment lands one billing cycle after
// the previous one), but never creates an Invoice row, same spirit as
// previewInvoiceCycle above. Used by the credit form to detect "the
// first installment's due date has already passed" and offer adding
// only the still-upcoming installments instead.
export async function previewInstallmentCycles(
  accountId: string,
  dateStr: string,
  installmentCount: number,
) {
  const userId = await requireUserId();
  if (!accountId || !dateStr || installmentCount < 1) return null;

  const account = await prisma.account.findUnique({
    where: { id: accountId, userId },
    include: { creditCardDetails: true },
  });
  if (!account?.creditCardDetails) return null;
  const creditCardDetails = account.creditCardDetails;

  let cursorDate = parseCalendarDate(dateStr);
  const cycles: { closingDate: Date; dueDate: Date }[] = [];

  for (let index = 0; index < installmentCount; index++) {
    // Exact match on the deterministic cycle for cursorDate — see the
    // identical fix + comment on resolveInvoiceForDate
    // (src/lib/invoice-resolution.ts) for why a ">=" search across gap
    // months (an account can easily have an invoice for an old month and
    // for the current one but nothing in between) used to make this loop
    // silently skip several installments' worth of months at once.
    const computed = computeInvoiceCycle(cursorDate, creditCardDetails);
    const existing = await prisma.invoice.findUnique({
      where: { accountId_closingDate: { accountId, closingDate: computed.closingDate } },
    });
    const cycle = existing ?? computed;
    cycles.push({ closingDate: cycle.closingDate, dueDate: cycle.dueDate });
    // +1 DAY, not +1 month — see computeCurrentInvoiceCycle's own note
    // in src/lib/invoice-resolution.ts: computeInvoiceCycle now treats
    // landing exactly ON a closing day as already belonging to the NEXT
    // cycle (the "dia de fechamento é o dia de abertura da próxima
    // fatura" rule), so feeding it the previous closing date itself
    // would double-advance — one real cycle skipped every iteration.
    // Nudging 1 day past it lands unambiguously inside the next cycle's
    // own window instead.
    cursorDate = fromAppZoned(addDays(toAppZoned(computed.closingDate), 1));
  }

  return cycles;
}

// Installment N's own transaction date: the purchase's original date
// advanced by N months, with the day-of-month clamped by addMonths to
// whatever the target month actually has (day 31 in a 30-day month
// becomes 30; in Fev becomes 28/29) — same wall-clock-digits-only
// reasoning as stepDate above. Always computed from the ORIGINAL date,
// never cumulatively from the previous installment's (possibly already
// clamped) date, so an earlier clamp can't compound into a wrong later
// date (Jan 31 → +1 = Feb 28, +2 = Mar 31, not Mar 28 from re-adding a
// month to the already-clamped Feb 28).
function installmentDate(originalDate: Date, monthsAhead: number): Date {
  return fromAppZoned(addMonths(toAppZoned(originalDate), monthsAhead));
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
        categoryRequired: tValidation("required"),
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
  // Defaults to `value.status` (the form's own single answer) — the
  // recurrence-generation loops below override this per occurrence
  // instead, since only THEY know each occurrence's own date.
  status?: DebitTransactionValues["status"];
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
      status: params.status ?? value.status,
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
    const startDate = parseCalendarDate(value.date);
    const todayDate = parseCalendarDate(todayCalendarDate());
    const windowEnd = fromAppZoned(
      addMonths(toAppZoned(startDate), RECURRENCE_GENERATION_WINDOW_MONTHS),
    );
    // personId is required on this form (unlike the batch rows' own
    // plain-string version) so this never comes back null — the ternary
    // below just satisfies resolveSplitsCreateInput's wider return type.
    const splitsCreateInput = resolveSplitsCreateInput(value, signedAmount);

    const recurrence = await prisma.recurrence.create({
      data: {
        userId,
        accountId: value.accountId,
        categoryId: value.categoryId || undefined,
        paymentMethod: value.paymentMethod === "" ? undefined : value.paymentMethod,
        description: value.description,
        amount: signedAmount,
        frequency: value.recurrence.toUpperCase() as "DAILY" | "WEEKLY" | "MONTHLY",
        startDate,
        splits: splitsCreateInput ? { create: splitsCreateInput } : undefined,
      },
    });

    let occurrenceDate = startDate;
    while (occurrenceDate <= windowEnd) {
      await createDebitTransactionRow({
        userId,
        value,
        amount: signedAmount,
        date: occurrenceDate,
        recurrenceId: recurrence.id,
        // Verified, real bug: every occurrence used to get the form's
        // own `value.status` (whatever the user picked for THIS first
        // charge) — a purchase entered as already paid stamped every
        // future occurrence COMPLETED too, up to a year out. Each one's
        // status has to follow its own date vs. today instead, same
        // rule /recurrences' own createRecurrenceOccurrence follows.
        status: occurrenceDate <= todayDate ? "COMPLETED" : "PENDING",
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
  const editedDate = parseCalendarDate(value.date);

  // Turning "Repetir" on while editing an until-now one-off transaction
  // converts it into the first occurrence of a brand new recurrence —
  // same shape as this screen's own create path (see
  // RECURRENCE_GENERATION_WINDOW_MONTHS above), just starting from this
  // row instead of a fresh one. A transaction that's already part of a
  // recurrence (existing.recurrenceId set) ignores this field instead of
  // starting a second, conflicting chain — editing an existing rule's own
  // frequency/occurrences is /recurrences' own job, not this form's.
  const isConvertingToRecurrence =
    value.recurrence !== "none" && existing.recurrenceId === null;
  const newRecurrenceId = isConvertingToRecurrence
    ? (
        await prisma.recurrence.create({
          data: {
            userId,
            accountId: value.accountId,
            categoryId: value.categoryId || undefined,
            paymentMethod: value.paymentMethod === "" ? undefined : value.paymentMethod,
            description: value.description,
            amount: signedAmount,
            frequency: value.recurrence.toUpperCase() as "DAILY" | "WEEKLY" | "MONTHLY",
            startDate: editedDate,
            splits: splitsCreateInput ? { create: splitsCreateInput } : undefined,
          },
        })
      ).id
    : undefined;

  await prisma.transaction.update({
    where: { id },
    data: {
      accountId: value.accountId,
      categoryId: value.categoryId || null,
      description: value.description,
      amount: signedAmount,
      date: editedDate,
      status: value.status,
      paymentMethod: value.paymentMethod === "" ? null : value.paymentMethod,
      recurrenceId: newRecurrenceId,
      splits: splitsCreateInput ? { create: splitsCreateInput } : undefined,
    },
  });

  if (isConvertingToRecurrence && newRecurrenceId) {
    const todayDate = parseCalendarDate(todayCalendarDate());
    const windowEnd = fromAppZoned(
      addMonths(toAppZoned(editedDate), RECURRENCE_GENERATION_WINDOW_MONTHS),
    );
    let occurrenceDate = stepDate(editedDate, value.recurrence);
    while (occurrenceDate <= windowEnd) {
      await createDebitTransactionRow({
        userId,
        value,
        amount: signedAmount,
        date: occurrenceDate,
        recurrenceId: newRecurrenceId,
        // Same fix as createDebitTransaction's own recurrence loop —
        // each generated occurrence's status follows its own date vs.
        // today, not the edited row's `value.status`.
        status: occurrenceDate <= todayDate ? "COMPLETED" : "PENDING",
      });
      occurrenceDate = stepDate(occurrenceDate, value.recurrence);
    }
  }

  revalidateTransactions();
  return { error: null };
}

// ---------------------------------------------------------------------
// Credit card purchases
// ---------------------------------------------------------------------

async function validateCredit(data: CreditTransactionFormValues) {
  const t = await getTranslations("scrn-transactions");
  const tValidation = await getTranslations("common.validation");

  const schema = creditTransactionSchema.superRefine((value, ctx) =>
    refineCreditTransaction(value, ctx, {
      categoryRequired: tValidation("required"),
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
  // Defaults to `value.status` (the form's own single answer) — the
  // recurrence-generation loops below override this per occurrence
  // instead, since only THEY know each occurrence's own date.
  status?: CreditTransactionValues["status"];
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
      status: params.status ?? value.status,
      installmentGroupId: params.installmentGroupId,
      installmentNumber: params.installmentNumber,
      installmentCount: params.installmentCount,
      recurrenceId: params.recurrenceId,
      splits: splitsCreateInput ? { create: splitsCreateInput } : undefined,
    },
  });

  const invoice = await resolveInvoiceForDate(value.accountId, cursorDate, creditCardDetails);
  // Advances from the pure, freshly-computed closingDate — never
  // `invoice.closingDate` itself. That field can come back from Prisma
  // as the DB's own UTC-midnight `@db.Date` representation (see
  // src/lib/date.ts's file-level comment on reading one of these
  // columns back), which isn't the same zoning `toAppZoned`/`fromAppZoned`
  // produce for a value headed into more date-fns math — piping a
  // DB-read value through that pipeline a second time drifted the
  // closing day by however many hours APP_TIME_ZONE's own offset is,
  // silently landing later installments on the wrong day (verified: an
  // account with closingDay 29 started minting day-30 invoices a few
  // installments into a purchase). +1 DAY, not +1 month, for the same
  // reason previewInstallmentCycles' own identical cursor advance uses
  // addDays now — see computeCurrentInvoiceCycle's comment in
  // src/lib/invoice-resolution.ts on why landing a cursor exactly ON a
  // closing day would otherwise double-advance a full cycle.
  const nextCursorDate = fromAppZoned(
    addDays(toAppZoned(computeInvoiceCycle(cursorDate, creditCardDetails).closingDate), 1),
  );

  await prisma.transactionInvoice.create({
    data: { transactionId: transaction.id, invoiceId: invoice.id },
  });
  await prisma.transactionCard.create({
    data: { transactionId: transaction.id, cardId: value.cardId },
  });

  return { transaction, nextCursorDate };
}

export async function createCreditTransaction(
  data: CreditTransactionFormValues,
  // Only meaningful when the purchase is installment-based (installments
  // > 1) and its first due date is already in the past — the credit
  // form asks the user in that case (see previewInstallmentCycles above)
  // whether to still create every installment or only the ones still
  // ahead. Ignored otherwise.
  options?: { skipPastInstallments?: boolean },
) {
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
  // refineCreditTransaction) — recurrence generates transactions across a
  // rolling window, same as a rule created directly on /recurrences (see
  // RECURRENCE_GENERATION_WINDOW_MONTHS), sharing one `Recurrence` row
  // (with its own RecurrenceSplit template) so it shows up there too and
  // can be extended/edited from that screen going forward.
  if (value.recurrence !== "none") {
    const startDate = parseCalendarDate(value.date);
    const todayDate = parseCalendarDate(todayCalendarDate());
    const windowEnd = fromAppZoned(
      addMonths(toAppZoned(startDate), RECURRENCE_GENERATION_WINDOW_MONTHS),
    );
    // personId is required on this form (unlike the batch rows' own
    // plain-string version) so this never comes back null — the ternary
    // below just satisfies resolveSplitsCreateInput's wider return type.
    const splitsCreateInput = resolveSplitsCreateInput(value, signedAmount);

    const recurrence = await prisma.recurrence.create({
      data: {
        userId,
        accountId: value.accountId,
        cardId: value.cardId,
        categoryId: value.categoryId || undefined,
        description: value.description,
        amount: signedAmount,
        frequency: value.recurrence.toUpperCase() as "DAILY" | "WEEKLY" | "MONTHLY",
        startDate,
        splits: splitsCreateInput ? { create: splitsCreateInput } : undefined,
      },
    });

    let occurrenceDate = startDate;
    while (occurrenceDate <= windowEnd) {
      await createCreditTransactionRow({
        userId,
        value,
        amount: signedAmount,
        date: occurrenceDate,
        creditCardDetails,
        recurrenceId: recurrence.id,
        cursorDate: occurrenceDate,
        // Verified, real bug — this is the exact one behind the wrong
        // "Gasto: R$X" totals reported on real data: every occurrence
        // used to get the form's own `value.status` (whatever the user
        // picked for THIS first charge), so a card purchase entered as
        // already paid stamped every future occurrence COMPLETED too,
        // up to a year out. Each one's status has to follow its own
        // date vs. today instead, same rule /recurrences' own
        // createRecurrenceOccurrence follows.
        status: occurrenceDate <= todayDate ? "COMPLETED" : "PENDING",
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
  // each installment charges — used as-is. Always divided/priced across
  // the FULL installmentCount, regardless of skipPastInstallments below
  // — "only the upcoming ones" changes which rows get persisted, not
  // what each installment is worth or its 1-based installmentNumber.
  const installmentAmount =
    value.installmentAmountMode === "perInstallment"
      ? signedAmount
      : signedAmount / installmentCount;

  const skipPastInstallments = options?.skipPastInstallments ?? false;
  const todayDate = parseCalendarDate(todayCalendarDate());
  const originalDate = parseCalendarDate(value.date);
  let createdCount = 0;
  let cursorDate = originalDate;

  for (let index = 0; index < installmentCount; index++) {
    // Pure, DB-free peek at this installment's cycle (mirrors
    // previewInstallmentCycles' own best-effort calculation) — only used
    // to decide whether to skip it and to advance the cursor for a
    // skipped one, so a later, still-upcoming installment still lands in
    // the right invoice even though nothing was persisted for the ones
    // before it. createCreditTransactionRow below still resolves (and
    // may create) the *real* Invoice row for every installment that's
    // actually persisted — a skipped installment's period is never
    // touched at all, so no empty/orphan Invoice gets created for it.
    const peekCycle = computeInvoiceCycle(cursorDate, creditCardDetails);

    if (skipPastInstallments && peekCycle.dueDate < todayDate) {
      // +1 day, not +1 month — see computeCurrentInvoiceCycle's own note.
      cursorDate = fromAppZoned(addDays(toAppZoned(peekCycle.closingDate), 1));
      continue;
    }

    createdCount++;
    const { nextCursorDate } = await createCreditTransactionRow({
      userId,
      value,
      amount: installmentAmount,
      date: installmentDate(originalDate, index),
      creditCardDetails,
      installmentGroupId,
      installmentNumber: installmentGroupId ? index + 1 : undefined,
      installmentCount: installmentGroupId ? installmentCount : undefined,
      cursorDate,
    });
    cursorDate = nextCursorDate;
  }

  // Only reachable if every one of installmentCount installments' due
  // dates was already in the past — shouldn't normally happen, since the
  // credit form only offers "apenas as próximas" when at least one
  // installment is still upcoming, but guarded here too rather than
  // silently creating nothing.
  if (skipPastInstallments && createdCount === 0) {
    const t = await getTranslations("scrn-transactions");
    return { error: t("fields.installments.noneUpcoming") };
  }

  revalidateCreditTransactions();
  return { error: null };
}

// v1 limitation: editing an already-installment purchase's installment
// count (or turning it back into a single à-vista charge) isn't
// supported — only the base fields, category, card, and splits. The one
// conversion this DOES handle is à vista → parcelada: turning a purchase
// that wasn't part of an installment group into one, by generating the
// remaining installments now (mirrors createCreditTransaction's own
// installment loop, starting the cursor from this transaction's own
// invoice instead of a freshly resolved one) — including the same
// skipPastInstallments choice createCreditTransaction offers, since
// converting an old purchase can put several of the new installments'
// due dates already in the past.
//
// `editScope` covers the other direction: editing a row that's already
// PART of an installment group. "this" (default) only ever touches the
// one row, same as always. "all"/"future" additionally propagate
// description/categoryId/status/splits (and amount, only if it actually
// changed) to every sibling installment, or just installmentNumber >=
// this one's for "future" — never accountId/cardId/date, since those are
// genuinely per-installment (retargeting a whole group's card would mean
// re-resolving every affected row's invoice, a bigger change than this
// covers). Splits are reapplied via the same literal amounts typed here
// against each target row, not rescaled to that row's own total — fine
// when every affected row ends up the same amount (the common case for
// "all"/"future"), a known simplification otherwise.
export async function updateCreditTransaction(
  id: string,
  data: CreditTransactionFormValues,
  options?: { skipPastInstallments?: boolean; editScope?: "this" | "all" | "future" },
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

  const installmentCount = value.installments;
  const isConvertingToInstallments =
    installmentCount > 1 && !existing.installmentGroupId;
  const installmentGroupId = isConvertingToInstallments
    ? crypto.randomUUID()
    : undefined;
  // Once converting, this transaction becomes installment 1/N — its own
  // amount has to shrink from "the whole purchase" to "one installment's
  // share" the same way createCreditTransaction's loop prices every row.
  const amount = isConvertingToInstallments
    ? value.installmentAmountMode === "perInstallment"
      ? signedAmount
      : signedAmount / installmentCount
    : signedAmount;

  const editedDate = parseCalendarDate(value.date);

  // Same "turning Repetir on converts this row into the first occurrence
  // of a new recurrence" conversion as updateDebitTransaction's own — see
  // its comment. `installmentGroupId === null` guards a case
  // refineCreditTransaction can't: it blocks recurrence+installments on a
  // single submission, but editing ONE existing installment of an
  // already-established group (installmentCount here can still be 1,
  // this row's own share) is a separate condition — this row must not
  // become both an installment AND the start of a recurrence at once.
  const isConvertingToRecurrence =
    value.recurrence !== "none" &&
    existing.recurrenceId === null &&
    existing.installmentGroupId === null;

  await prisma.transactionSplit.deleteMany({ where: { transactionId: id } });
  const splitsCreateInput = resolveSplitsCreateInput(value, amount);

  const newRecurrenceId = isConvertingToRecurrence
    ? (
        await prisma.recurrence.create({
          data: {
            userId,
            accountId: value.accountId,
            cardId: value.cardId,
            categoryId: value.categoryId || undefined,
            description: value.description,
            amount: signedAmount,
            frequency: value.recurrence.toUpperCase() as "DAILY" | "WEEKLY" | "MONTHLY",
            startDate: editedDate,
            splits: splitsCreateInput ? { create: splitsCreateInput } : undefined,
          },
        })
      ).id
    : undefined;

  await prisma.transaction.update({
    where: { id },
    data: {
      accountId: value.accountId,
      categoryId: value.categoryId || null,
      description: value.description,
      amount,
      date: editedDate,
      status: value.status,
      recurrenceId: newRecurrenceId,
      splits: splitsCreateInput ? { create: splitsCreateInput } : undefined,
      ...(isConvertingToInstallments
        ? { installmentGroupId, installmentNumber: 1, installmentCount }
        : {}),
    },
  });

  await prisma.transactionCard.upsert({
    where: { transactionId: id },
    update: { cardId: value.cardId },
    create: { transactionId: id, cardId: value.cardId },
  });

  if (isConvertingToRecurrence && newRecurrenceId) {
    const account = await prisma.account.findUnique({
      where: { id: value.accountId, userId },
      include: { creditCardDetails: true },
    });
    if (!account || account.type !== "CREDIT_CARD" || !account.creditCardDetails) {
      return { error: "Invalid account" };
    }
    const creditCardDetails = account.creditCardDetails;
    const todayDate = parseCalendarDate(todayCalendarDate());
    const windowEnd = fromAppZoned(
      addMonths(toAppZoned(editedDate), RECURRENCE_GENERATION_WINDOW_MONTHS),
    );
    let occurrenceDate = stepDate(editedDate, value.recurrence);
    while (occurrenceDate <= windowEnd) {
      await createCreditTransactionRow({
        userId,
        value,
        amount: signedAmount,
        date: occurrenceDate,
        creditCardDetails,
        recurrenceId: newRecurrenceId,
        cursorDate: occurrenceDate,
        // Same fix as createCreditTransaction's own recurrence loop —
        // each generated occurrence's status follows its own date vs.
        // today, not the edited row's `value.status`.
        status: occurrenceDate <= todayDate ? "COMPLETED" : "PENDING",
      });
      occurrenceDate = stepDate(occurrenceDate, value.recurrence);
    }
  }

  if (isConvertingToInstallments) {
    const account = await prisma.account.findUnique({
      where: { id: value.accountId, userId },
      include: { creditCardDetails: true },
    });
    if (!account || account.type !== "CREDIT_CARD" || !account.creditCardDetails) {
      return { error: "Invalid account" };
    }
    const creditCardDetails = account.creditCardDetails;

    const firstDate = editedDate;
    // Result unused — this call's only job here is to ensure the first
    // installment's invoice exists; the cycles below are pure
    // recomputations (see the comment above), not reads of this return.
    await resolveInvoiceForDate(value.accountId, firstDate, creditCardDetails);
    const skipPastInstallments = options?.skipPastInstallments ?? false;
    const todayDate = parseCalendarDate(todayCalendarDate());
    // Pure recomputation, not firstInvoice.closingDate directly — see
    // createCreditTransactionRow's own identical comment on why a
    // DB-read closingDate can't safely re-enter the toAppZoned/addDays/
    // fromAppZoned pipeline a second time. +1 day, not +1 month — see
    // computeCurrentInvoiceCycle's own note in invoice-resolution.ts.
    let cursorDate = fromAppZoned(
      addDays(toAppZoned(computeInvoiceCycle(firstDate, creditCardDetails).closingDate), 1),
    );
    let createdCount = 0;

    for (let index = 1; index < installmentCount; index++) {
      const peekCycle = computeInvoiceCycle(cursorDate, creditCardDetails);

      if (skipPastInstallments && peekCycle.dueDate < todayDate) {
        cursorDate = fromAppZoned(addDays(toAppZoned(peekCycle.closingDate), 1));
        continue;
      }

      createdCount++;
      const { nextCursorDate } = await createCreditTransactionRow({
        userId,
        value,
        amount,
        date: installmentDate(firstDate, index),
        creditCardDetails,
        installmentGroupId,
        installmentNumber: index + 1,
        installmentCount,
        cursorDate,
      });
      cursorDate = nextCursorDate;
    }

    // Only reachable if every one of the NEW installments' (2..N) due
    // dates was already in the past — shouldn't normally happen, since
    // the form only offers "apenas as próximas" when at least one is
    // still upcoming, but guarded here too rather than silently leaving
    // this transaction claiming N installments while only 1 exists.
    if (skipPastInstallments && createdCount === 0) {
      const t = await getTranslations("scrn-transactions");
      return { error: t("fields.installments.noneUpcoming") };
    }
  }

  const editScope = options?.editScope ?? "this";
  if (existing.installmentGroupId && editScope !== "this") {
    const amountChanged = Math.abs(existing.amount.toNumber() - amount) > 0.001;

    const siblings = await prisma.transaction.findMany({
      where: {
        userId,
        installmentGroupId: existing.installmentGroupId,
        id: { not: id },
        ...(editScope === "future" && existing.installmentNumber != null
          ? { installmentNumber: { gte: existing.installmentNumber } }
          : {}),
      },
    });

    // Sequential, not Promise.all — same "one row at a time" discipline
    // every other multi-row loop in this file follows against Neon's
    // serverless driver.
    for (const sibling of siblings) {
      const siblingAmount = amountChanged ? amount : sibling.amount.toNumber();
      await prisma.transactionSplit.deleteMany({ where: { transactionId: sibling.id } });
      const siblingSplitsCreateInput = resolveSplitsCreateInput(value, siblingAmount);
      await prisma.transaction.update({
        where: { id: sibling.id },
        data: {
          categoryId: value.categoryId || null,
          description: value.description,
          status: value.status,
          ...(amountChanged ? { amount: siblingAmount } : {}),
          splits: siblingSplitsCreateInput
            ? { create: siblingSplitsCreateInput }
            : undefined,
        },
      });
    }
  }

  // Resizing the group's own installment count — independent of
  // editScope above (that only decides how far description/category/
  // status/amount propagate to EXISTING siblings; this decides whether
  // installments need to be added or removed). Runs after the amount
  // possibly changed above, so a grown group's new rows continue at
  // whatever the per-installment amount ends up being.
  if (
    existing.installmentGroupId &&
    existing.installmentCount !== null &&
    installmentCount !== existing.installmentCount
  ) {
    const groupId = existing.installmentGroupId;
    const t = await getTranslations("scrn-transactions");

    if (installmentCount > existing.installmentCount) {
      // Grow: append new installments after the current last one, same
      // per-installment amount, continuing the exact same monthly cadence
      // from the group's own installment 1 (never re-derived from
      // whatever installment happens to be last, so a manually-edited
      // date on an existing row can't drift the new ones' schedule).
      const firstInstallment = await prisma.transaction.findFirst({
        where: { userId, installmentGroupId: groupId, installmentNumber: 1 },
      });
      const lastInstallment = await prisma.transaction.findFirst({
        where: { userId, installmentGroupId: groupId },
        orderBy: { installmentNumber: "desc" },
      });
      if (!firstInstallment || !lastInstallment) {
        return { error: "Not found" };
      }

      const account = await prisma.account.findUnique({
        where: { id: lastInstallment.accountId, userId },
        include: { creditCardDetails: true },
      });
      if (!account || account.type !== "CREDIT_CARD" || !account.creditCardDetails) {
        return { error: "Invalid account" };
      }
      const creditCardDetails = account.creditCardDetails;

      // Same +1-day cursor advance as extendRecurrenceGeneration's own —
      // start right after the last existing installment's own cycle.
      let cursorDate = fromAppZoned(
        addDays(
          toAppZoned(computeInvoiceCycle(lastInstallment.date, creditCardDetails).closingDate),
          1,
        ),
      );

      for (
        let newNumber = existing.installmentCount + 1;
        newNumber <= installmentCount;
        newNumber++
      ) {
        const { nextCursorDate } = await createCreditTransactionRow({
          userId,
          value,
          amount,
          date: installmentDate(firstInstallment.date, newNumber - 1),
          creditCardDetails,
          installmentGroupId: groupId,
          installmentNumber: newNumber,
          installmentCount,
          cursorDate,
        });
        cursorDate = nextCursorDate;
      }

      await prisma.transaction.updateMany({
        where: { userId, installmentGroupId: groupId, installmentNumber: { lte: existing.installmentCount } },
        data: { installmentCount },
      });
    } else {
      // Shrink: remove installments from the end down to the new count
      // — installmentNumber existing.installmentCount, then -1, ...,
      // down to installmentCount + 1 — never the other direction, so a
      // partial failure never leaves a gap in the middle of the
      // schedule. Blocked entirely (nothing deleted) if ANY of those
      // already has a payment: same policy deleteTransaction's own
      // installment-group guard uses — this never deletes a payment on
      // the user's behalf, only tells them to undo it first.
      const removedNumbers: number[] = [];
      for (let n = existing.installmentCount; n > installmentCount; n--) {
        removedNumbers.push(n);
      }

      const toRemove = await prisma.transaction.findMany({
        where: { userId, installmentGroupId: groupId, installmentNumber: { in: removedNumbers } },
        include: {
          transactionInvoice: { include: { invoice: { include: { payments: true } } } },
        },
        orderBy: { installmentNumber: "desc" },
      });

      const paidCount = toRemove.filter(
        (row) => (row.transactionInvoice?.invoice.payments.length ?? 0) > 0,
      ).length;
      if (paidCount > 0) {
        return { error: t("fields.installments.groupHasPaid", { count: paidCount }) };
      }

      await prisma.$transaction(async (tx) => {
        const removeIds = toRemove.map((row) => row.id);
        const affectedInvoiceIds = await invoiceIdsAffectedByDeleting(tx, userId, removeIds);
        // Already ordered desc (last installment first) from the query
        // above — one at a time, per this file's own "sequential against
        // Neon's serverless driver" discipline.
        for (const row of toRemove) {
          await tx.transaction.deleteMany({ where: { id: row.id, userId } });
        }
        await recomputeAffectedInvoices(tx, affectedInvoiceIds);
      });

      await prisma.transaction.updateMany({
        where: { userId, installmentGroupId: groupId },
        data: { installmentCount },
      });
    }
  }

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
    if (!value.categoryId) {
      return { error: t("batch.categoryRequired"), rowIndex: index };
    }
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

  const todayDate = parseCalendarDate(todayCalendarDate());

  for (const { index: rowIndex, value } of parsedRows) {
    const account = accountById.get(value.accountId)!;
    const creditCardDetails = account.creditCardDetails!;
    const signedAmount = value.type === "expense" ? -value.amount : value.amount;

    const installmentCount = value.installments;
    const installmentGroupId = installmentCount > 1 ? crypto.randomUUID() : undefined;
    // Same "total" vs "perInstallment" convention as createCreditTransaction
    // above (see its own comment) — "total": the typed amount is the whole
    // purchase, split evenly. "perInstallment": it's already what each
    // installment charges, used as-is.
    const installmentAmount =
      value.installmentAmountMode === "perInstallment"
        ? signedAmount
        : signedAmount / installmentCount;

    const originalDate = parseCalendarDate(value.date);
    let cursorDate = originalDate;
    let createdCount = 0;

    for (let index = 0; index < installmentCount; index++) {
      // Same skip-and-advance-the-cursor pattern as createCreditTransaction's
      // own loop above (see its comment) — a row queued via
      // PastInstallmentsDialog's "só as próximas" carries
      // skipPastInstallments on itself, since this function takes one
      // plain array of rows instead of a separate per-call options param.
      const peekCycle = computeInvoiceCycle(cursorDate, creditCardDetails);
      if (value.skipPastInstallments && peekCycle.dueDate < todayDate) {
        cursorDate = fromAppZoned(addDays(toAppZoned(peekCycle.closingDate), 1));
        continue;
      }

      createdCount++;
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
        date: installmentDate(originalDate, index),
        creditCardDetails,
        installmentGroupId,
        installmentNumber: installmentGroupId ? index + 1 : undefined,
        installmentCount: installmentGroupId ? installmentCount : undefined,
        cursorDate,
      });
      cursorDate = nextCursorDate;
    }

    // Same guard as createCreditTransaction's own — shouldn't normally
    // happen, since the batch table only offers "só as próximas" when at
    // least one installment is still upcoming, but this is the
    // server-side backstop.
    if (value.skipPastInstallments && createdCount === 0) {
      return { error: t("fields.installments.noneUpcoming"), rowIndex };
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
// Installments naturally come as a group (one Transaction per month) —
// deleting just one, silently leaving the rest, is rarely what's
// actually wanted. When `id` belongs to one:
//   1. If ANY sibling installment's own invoice already has a payment,
//      the whole delete is blocked (`error` set) — this never deletes a
//      payment on the user's behalf, only says to undo it first (on the
//      invoice) before the schedule itself can be touched.
//   2. Otherwise, if `options.installmentScope` wasn't given yet, nothing
//      is deleted — `needsInstallmentScope` comes back instead so the
//      caller (DeleteDialog) can ask "só esta parcela ou todas?" and
//      resubmit with the answer.
//   3. With `installmentScope: "all"`, every installment in the group is
//      removed, from the LAST installmentNumber down to the first — so
//      a failure partway through never leaves a gap in the middle of an
//      otherwise-intact schedule.
// A plain (non-installment) transaction skips all of this — same single
// delete as always.
export async function deleteTransaction(
  id: string,
  options?: { installmentScope?: "this" | "all" },
) {
  const userId = await requireUserId();

  const existing = await prisma.transaction.findUnique({
    where: { id, userId },
    select: { installmentGroupId: true },
  });
  if (!existing) {
    return { error: "Not found" };
  }

  let idsToDelete = [id];

  if (existing.installmentGroupId) {
    // Ordered desc (last installment first) up front — reused as-is for
    // the actual delete loop below once a scope is known.
    const siblings = await prisma.transaction.findMany({
      where: { userId, installmentGroupId: existing.installmentGroupId },
      include: {
        transactionInvoice: { include: { invoice: { include: { payments: true } } } },
      },
      orderBy: { installmentNumber: "desc" },
    });

    const paidCount = siblings.filter(
      (row) => (row.transactionInvoice?.invoice.payments.length ?? 0) > 0,
    ).length;
    if (paidCount > 0) {
      const t = await getTranslations("scrn-transactions");
      return { error: t("fields.installments.groupHasPaid", { count: paidCount }) };
    }

    if (!options?.installmentScope) {
      const target = siblings.find((row) => row.id === id);
      return {
        error: null,
        needsInstallmentScope: {
          installmentNumber: target?.installmentNumber ?? 1,
          installmentCount: siblings.length,
        },
      };
    }

    idsToDelete =
      options.installmentScope === "all" ? siblings.map((row) => row.id) : [id];
  }

  await prisma.$transaction(async (tx) => {
    const affectedInvoiceIds = await invoiceIdsAffectedByDeleting(tx, userId, idsToDelete);
    for (const deleteId of idsToDelete) {
      await tx.transaction.deleteMany({ where: { id: deleteId, userId } });
    }
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

  const result = await prisma.$transaction(
    async (tx) => {
      const affectedInvoiceIds = await invoiceIdsAffectedByDeleting(tx, userId, ids);
      const deleteResult = await tx.transaction.deleteMany({ where: { id: { in: ids }, userId } });
      await recomputeAffectedInvoices(tx, affectedInvoiceIds);
      return deleteResult;
    },
    // Same "unbounded work scaling with how many rows the user selected"
    // risk createTransactionsBatch's own $transaction call has, past
    // Prisma's 5000ms interactive-transaction default — see that call's
    // own comment for the real timeout failure this mirrors. Bumped
    // alongside it, 30000 → 60000.
    { timeout: 60000 },
  );

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
  // credit-card AND investment/pocket accounts from the picker, so this
  // is the server-side backstop for a stale client submitting one
  // anyway. A credit-card row would create a real Transaction with no
  // TransactionCard/TransactionInvoice link, since none of that logic
  // runs here the way it does in createCreditTransaction; an investment/
  // pocket row would bypass createInvestmentMovement's transfer-pair
  // logic entirely, posting a single-leg Transaction that never touches
  // any other account.
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
    if (!value.categoryId) {
      return { error: t("batch.categoryRequired"), rowIndex: index };
    }
    if (!value.personId) {
      return { error: t("batch.personRequired"), rowIndex: index };
    }
    if (!value.paymentMethod) {
      return { error: t("batch.paymentMethodRequired"), rowIndex: index };
    }
    // Mirrors refineDebitTransaction's own splits-sum-matches-amount rule
    // — same unrefined-in-the-schema, checked-here reasoning as
    // personId/paymentMethod above (see batchRowSchema's own comment).
    if (value.splits.length > 0) {
      const splitsTotal = value.splits.reduce((sum, split) => sum + split.amount, 0);
      if (Math.abs(splitsTotal - value.amount) > 0.01) {
        return { error: t("splits.mismatch"), rowIndex: index };
      }
    }
    const rowAccountType = accountTypeById.get(value.accountId);
    if (rowAccountType === "CREDIT_CARD") {
      return { error: t("batch.creditCardNotAllowed"), rowIndex: index };
    }
    if (rowAccountType === "INVESTMENT" || rowAccountType === "POCKET") {
      return { error: t("batch.investmentAccountNotAllowed"), rowIndex: index };
    }
  }

  await prisma.$transaction(
    parsedRows.map(({ value }) => {
      const signedAmount = value.type === "expense" ? -value.amount : value.amount;
      const splitsCreateInput = resolveSplitsCreateInput(value, signedAmount);
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
          splits: splitsCreateInput ? { create: splitsCreateInput } : undefined,
        },
      });
    }),
    // Prisma's own interactive-transaction default (5000ms) was never
    // meant for a batch whose size scales with however many rows the
    // user queued up — over Neon's serverless driver, each row is a real
    // network round-trip, so a batch of even a few dozen rows can
    // legitimately take longer than that. This was a real, verified
    // failure ("Transaction API error: A rollback cannot be executed on
    // an expired transaction... 24441 ms passed"), not a hypothetical.
    // Bumped from 30000 to 60000 — rows can now also carry splits (extra
    // inserts per row), pushing bigger batches closer to the old ceiling.
    { timeout: 60000 },
  );

  revalidateTransactions();
  return { error: null, rowIndex: null };
}

// ---------------------------------------------------------------------
// Importação de fatura/extrato — lê o arquivo anexado e devolve os
// lançamentos reconhecidos. NÃO grava nada: o que sai daqui volta pro
// cliente como linhas pré-preenchidas do lote, que o usuário confere e
// completa (pessoa/categoria) antes de mandar pro
// createTransactionsBatch/createCreditTransactionsBatch de sempre. Ler e
// gravar em uma chamada só pareceria mais direto, mas um erro de leitura
// viraria transação de verdade sem ninguém ter olhado.
// ---------------------------------------------------------------------
export async function importStatementFile(formData: FormData) {
  await requireUserId();

  const t = await getTranslations("scrn-transactions");
  const empty: StatementEntry[] = [];

  const file = formData.get("file");
  const source = formData.get("source");

  if (!(file instanceof File) || file.size === 0) {
    return { error: t("import.errors.noFile"), entries: empty };
  }
  if (!statementSourceKindValues.includes(source as StatementSourceKind)) {
    return { error: t("import.errors.failed"), entries: empty };
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return {
      error: t("import.errors.tooLarge", { size: MAX_IMPORT_FILE_MB }),
      entries: empty,
    };
  }
  // The browser reports the type; a file with none (some Android
  // pickers) falls through to the same "unsupported" answer as a .docx,
  // which is the honest one — nothing downstream can read it.
  if (!ACCEPTED_IMPORT_MEDIA_TYPES.includes(file.type as never)) {
    return { error: t("import.errors.unsupported"), entries: empty };
  }

  const result = await parseStatement({
    bytes: new Uint8Array(await file.arrayBuffer()),
    mediaType: file.type,
    source: source as StatementSourceKind,
    today: todayCalendarDate(),
  });

  if (result.status === "no-text") {
    return { error: t("import.errors.noText"), entries: empty };
  }
  if (result.status === "not-configured") {
    return { error: t("import.errors.notConfigured"), entries: empty };
  }
  if (result.status === "truncated") {
    return { error: t("import.errors.truncated"), entries: empty };
  }
  if (result.status === "rate-limited") {
    return {
      error: t("import.errors.rateLimited", {
        seconds: result.retryAfterSeconds ?? 60,
      }),
      entries: empty,
    };
  }
  if (result.entries.length === 0) {
    return { error: t("import.errors.nothingFound"), entries: empty };
  }

  return { error: null, entries: result.entries };
}
