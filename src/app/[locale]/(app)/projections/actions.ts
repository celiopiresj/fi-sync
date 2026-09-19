"use server";

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { sumInvoiceTransactionsTotal } from "@/lib/invoice-total";
import { dateOnlyKey, parseCalendarDate, toAppZoned, todayCalendarDate } from "@/lib/date";
import {
  addMonths,
  monthFirstDay,
  monthKey,
  monthLastDay,
  type ProjectionMonth,
} from "./_lib/projection-month";
import { selfShareAmount } from "./_lib/self-share";
import { MAX_MONTHS_AHEAD } from "./_constants/constants";

// Shared by every query below that needs to compute a transaction's
// self-share amount.
const SPLITS_SELECT = {
  select: {
    amount: true,
    person: { select: { isSelf: true } },
  },
} as const;

function toSplitInputs(
  splits: { amount: { toNumber(): number }; person: { isSelf: boolean } }[],
) {
  return splits.map((split) => ({
    amount: split.amount.toNumber(),
    person: split.person,
  }));
}

// Self-attributed loan installments still unpaid — the same "still-owed
// obligation" a recurring PENDING transaction already contributes to
// this series, except a LoanInstallment has no Transaction row at all
// until it's actually paid (registerLoanPayment, loans/actions.ts), so
// it's invisible to the futureTransactions query below unless fetched
// separately here. `loan.person.isSelf` stands in for selfShareAmount's
// splits check — a LoanInstallment has no splits of its own, just the
// one Loan.personId, so a loan "with" someone else (isSelf: false) is
// left out entirely, same as a transaction whose only split belongs to
// a non-self Person. `installment.amount` is already the plain positive
// nominal amount (loanSchema's own decimalString) — never negative the
// way a posted payment Transaction's `amount` is, so callers add it
// straight into an expense total without an extra Math.abs.
async function fetchUnpaidSelfLoanInstallments(userId: string, throughDate: Date) {
  return prisma.loanInstallment.findMany({
    where: {
      transactionId: null,
      dueDate: { lte: throughDate },
      loan: { userId, person: { isSelf: true } },
    },
    select: {
      id: true,
      dueDate: true,
      amount: true,
      loan: { select: { description: true } },
    },
    orderBy: { dueDate: "asc" },
  });
}

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// One month's worth of the trajectory, plus the exact date range it
// covers (needed by getProjectionDetail below to fetch that month's line
// items with the identical boundaries this used for its own totals —
// duplicating the range logic there would risk the two silently
// drifting apart, e.g. on the current month's "today, not the 1st"
// start date).
type MonthSeriesEntry = {
  monthKey: string;
  isCurrentMonth: boolean;
  fromDate: Date;
  toDate: Date;
  initialBalance: number;
  // Same as initialBalance for every future month (nothing in a month
  // that hasn't started yet can have "already happened"), but for the
  // current month it's initialBalance PLUS whatever of this month's own
  // real transactions are already dated <= today — see its own comment
  // where it's computed. This, not initialBalance, is "Saldo Atual":
  // initialBalance is deliberately the balance BEFORE the current month
  // even starts (see this file's own comment on why the current month
  // covers its full calendar span), so showing it under a "current
  // balance" label would leave out everything that's already happened
  // this month (a salary already received, bills already paid) —
  // verified, real bug: a user's real Sept-1-through-today activity
  // (salário, card invoice payments, ...) never moved the KPI at all,
  // even days into the month.
  currentBalance: number;
  projectedBalance: number;
  incomeForecast: number;
  accountExpenses: number;
  cardExpenses: number;
  // Loan installments — paid ones (a real Transaction, tagged via its
  // own loanInstallment relation) and unpaid ones (fetched separately,
  // see fetchUnpaidSelfLoanInstallments) both land here, never in
  // accountExpenses, even though a loan payment posts to the same kind
  // of checking/savings/cash account a "conta" expense does — shown in
  // its own "Empréstimo" card, not lumped into "Contas Fixas /
  // Recorrentes", so the two totals don't need untangling by eye.
  loanExpenses: number;
  totalExpenses: number;
  status: "ok" | "warning" | "danger";
};

// Danger: the month itself ends in the red. Warning: it doesn't, but the
// balance couldn't absorb another month that size — i.e. there's less
// than one month's own spending left as a buffer. Anything more
// comfortable than that is ok. Not one of tasks/016's three "User Review
// Required" questions — a UX judgment call, documented here rather than
// asked about.
function riskStatusFor(
  projectedBalance: number,
  totalExpenses: number,
): MonthSeriesEntry["status"] {
  if (projectedBalance < 0) return "danger";
  if (projectedBalance < totalExpenses) return "warning";
  return "ok";
}

// Shared core: computes the full MAX_MONTHS_AHEAD trajectory once.
// getProjections (below) slices it to whatever the period selector asked
// for; getProjectionDetail looks up the one month it needs — both read
// from this same series so the running balance can never disagree
// between the overview and the detail page for the same month.
async function computeMonthSeries(userId: string): Promise<MonthSeriesEntry[]> {
  const zonedToday = toAppZoned(new Date());
  const currentMonth: ProjectionMonth = {
    year: zonedToday.getFullYear(),
    month: zonedToday.getMonth(),
  };
  // The current month's own bucket covers its FULL calendar span, same
  // as every future month — not "today onward". Splitting it at today
  // instead used to zero out a month's own recurring salary/bills the
  // moment their date passed, which read as "nothing left to receive/
  // spend this month" even on the 2nd of the month, right after payday.
  // The month-end running balance is unaffected either way (every
  // transaction dated <= month-end still counts exactly once) — only
  // where the split between "starting balance" and "this month's
  // forecast" falls changes.
  const currentMonthStartDate = parseCalendarDate(monthFirstDay(currentMonth));
  const todayDate = parseCalendarDate(todayCalendarDate());
  const horizonEndDate = parseCalendarDate(
    monthLastDay(addMonths(currentMonth, MAX_MONTHS_AHEAD - 1)),
  );

  // Saldo inicial: Account has no stored balance field (tasks/016's own
  // open question 1) — the only source of truth is summing every
  // non-credit-card transaction dated before the current month started.
  // `status: { not: FAILED }` (not `COMPLETED` only) so a transaction
  // still PENDING from a few days ago — hasn't been marked COMPLETED
  // yet, but already happened — still counts; only a cancelled one is
  // excluded. Every sum below is the user's own share (selfShareAmount),
  // not the transaction's full amount — a shared/split expense only
  // counts toward the user's own projected cash flow through whatever
  // slice belongs to the Person marked isSelf.
  const pastTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      status: { not: "FAILED" },
      date: { lt: currentMonthStartDate },
      account: { type: { not: "CREDIT_CARD" } },
    },
    select: { amount: true, splits: SPLITS_SELECT },
  });

  // Every non-card transaction and every card invoice from the current
  // month onward, in one query each (not one query per month — same "one
  // query, bucket in JS" shape budgets/actions.ts's getBudgetWithSpending
  // uses for its own per-category spending). `date/dueDate: { gte:
  // currentMonthStartDate }` — the current month's own already-passed
  // days included, not just what's still ahead of today (see the comment
  // above) — so anything dated before pastTransactions' own cutoff isn't
  // double-counted here.
  const [futureTransactions, unpaidLoanInstallments, futureInvoices] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
        status: { not: "FAILED" },
        date: { gte: currentMonthStartDate, lte: horizonEndDate },
        account: { type: { not: "CREDIT_CARD" } },
      },
      select: {
        date: true,
        amount: true,
        splits: SPLITS_SELECT,
        // Non-null exactly for an invoice-payment settlement Transaction
        // (invoices/actions.ts's payInvoice) — real money on a real
        // checking/savings/cash account, but it's paying off card debt,
        // not a "conta" expense. Below, this is what keeps that spend
        // counted as cardExpenses instead of accountExpenses once the
        // invoice it belongs to is actually paid (see the comment on
        // that branch).
        invoicePayment: { select: { id: true } },
        // Same idea, for a loan installment's own settlement
        // (registerLoanPayment, loans/actions.ts) — keeps it counted as
        // loanExpenses instead of accountExpenses once it's actually
        // paid, same as fetchUnpaidSelfLoanInstallments' rows are before
        // that happens.
        loanInstallment: { select: { id: true } },
      },
    }),
    fetchUnpaidSelfLoanInstallments(userId, horizonEndDate),
    prisma.invoice.findMany({
      where: {
        account: { userId, type: "CREDIT_CARD" },
        status: { not: "PAID" },
        dueDate: { gte: currentMonthStartDate, lte: horizonEndDate },
      },
      include: {
        transactionInvoices: {
          include: {
            transaction: { select: { amount: true, splits: SPLITS_SELECT } },
          },
        },
        payments: { select: { amount: true } },
        creditsReceived: { select: { amount: true } },
      },
    }),
  ]);

  const pastSum = pastTransactions.reduce(
    (sum, transaction) =>
      sum +
      selfShareAmount(
        transaction.amount.toNumber(),
        toSplitInputs(transaction.splits),
      ),
    0,
  );

  const incomeByMonth = new Map<string, number>();
  const accountExpenseByMonth = new Map<string, number>();
  // Declared here (not after this loop, where every other by-month map
  // below is built) so an invoice-payment settlement can add straight
  // into it as it's found, alongside the still-unpaid invoices' own
  // contribution further down.
  const cardExpenseByMonth = new Map<string, number>();
  // Same "declared early, an in-loop tag routes straight into it" shape
  // as cardExpenseByMonth above — a paid loan installment's own
  // settlement Transaction is tagged via its loanInstallment relation,
  // an unpaid one is added separately just below this loop.
  const loanExpenseByMonth = new Map<string, number>();
  // Self-share of this month's own transactions already dated <= today —
  // real money that's already moved, as opposed to the rest of the
  // month's forecast, which hasn't happened yet. Only ever non-zero for
  // the current month (every other month in futureTransactions is
  // entirely in the future relative to today by construction), added to
  // that one entry's initialBalance below to get currentBalance. An
  // unpaid invoice due today or earlier is deliberately NOT included
  // here even though its dueDate has passed — no real money has left the
  // account for it yet, only payInvoice actually moving it (as a
  // transaction landing in this same loop, tagged invoicePayment) makes
  // it "realized".
  let realizedThisMonth = 0;

  for (const transaction of futureTransactions) {
    const key = dateOnlyKey(transaction.date).slice(0, 7);
    const amount = selfShareAmount(
      transaction.amount.toNumber(),
      toSplitInputs(transaction.splits),
    );
    if (transaction.date <= todayDate) {
      realizedThisMonth += amount;
    }
    if (amount >= 0) {
      incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + amount);
    } else if (transaction.invoicePayment) {
      // Paying off a card invoice is card spending, however you slice
      // it — it doesn't turn into a "conta" expense just because the
      // settlement Transaction itself posts to a checking/savings/cash
      // account. Counted in the month the PAYMENT actually happened, not
      // the invoice's own dueDate month: that's the whole reason this
      // still shows up at all once the invoice is PAID and drops out of
      // futureInvoices below — using the settlement's real date (always
      // >= currentMonthStartDate, same as this transaction itself) is
      // what keeps the money from disappearing into a month this series
      // doesn't cover, if the invoice was originally due before this
      // window even started.
      cardExpenseByMonth.set(
        key,
        (cardExpenseByMonth.get(key) ?? 0) + Math.abs(amount),
      );
    } else if (transaction.loanInstallment) {
      loanExpenseByMonth.set(
        key,
        (loanExpenseByMonth.get(key) ?? 0) + Math.abs(amount),
      );
    } else {
      accountExpenseByMonth.set(
        key,
        (accountExpenseByMonth.get(key) ?? 0) + Math.abs(amount),
      );
    }
  }

  // Unpaid, not yet due-and-completed — never contributes to
  // realizedThisMonth the way a real transaction dated <= today does
  // (see the comment on that variable above): no money has actually
  // left the account for an unpaid installment yet, only registerLoanPayment
  // does that. An installment overdue from before this window even
  // started is clamped into the current month's own bucket instead of
  // silently falling off the edge of the series — it's still owed, and
  // will land on some real payment once it's finally made.
  for (const installment of unpaidLoanInstallments) {
    const bucketDate =
      installment.dueDate < currentMonthStartDate
        ? currentMonthStartDate
        : installment.dueDate;
    const key = dateOnlyKey(bucketDate).slice(0, 7);
    loanExpenseByMonth.set(
      key,
      (loanExpenseByMonth.get(key) ?? 0) + installment.amount.toNumber(),
    );
  }

  for (const invoice of futureInvoices) {
    const key = dateOnlyKey(invoice.dueDate).slice(0, 7);
    const selfShareTotal = invoice.transactionInvoices.reduce(
      (sum, ti) =>
        sum +
        Math.abs(
          selfShareAmount(
            ti.transaction.amount.toNumber(),
            toSplitInputs(ti.transaction.splits),
          ),
        ),
      0,
    );
    // A payment already made (or credit already applied) against this
    // invoice reduces what's still actually owed — same rule
    // cards/actions.ts's own availableLimit follows. Payments/credit
    // aren't tracked per-person, so this scales the self-share total by
    // how much of the WHOLE invoice remains outstanding, same
    // proportional assumption the original auto-split payment always
    // made.
    const invoiceTotal = sumInvoiceTransactionsTotal(invoice.transactionInvoices);
    const paidAmount = invoice.payments.reduce((sum, payment) => sum + payment.amount.toNumber(), 0);
    const creditApplied = invoice.creditsReceived.reduce(
      (sum, credit) => sum + credit.amount.toNumber(),
      0,
    );
    const remainingRatio =
      invoiceTotal > 0 ? Math.max(0, invoiceTotal - paidAmount - creditApplied) / invoiceTotal : 0;
    cardExpenseByMonth.set(
      key,
      (cardExpenseByMonth.get(key) ?? 0) + selfShareTotal * remainingRatio,
    );
  }

  let runningBalance = pastSum;
  const entries: MonthSeriesEntry[] = [];

  for (let i = 0; i < MAX_MONTHS_AHEAD; i++) {
    const month = addMonths(currentMonth, i);
    const key = monthKey(month);
    const isCurrentMonth = i === 0;

    const incomeForecast = incomeByMonth.get(key) ?? 0;
    const accountExpenses = accountExpenseByMonth.get(key) ?? 0;
    const cardExpenses = cardExpenseByMonth.get(key) ?? 0;
    const loanExpenses = loanExpenseByMonth.get(key) ?? 0;
    const totalExpenses = accountExpenses + cardExpenses + loanExpenses;

    const initialBalance = runningBalance;
    runningBalance = runningBalance + incomeForecast - totalExpenses;

    entries.push({
      monthKey: key,
      isCurrentMonth,
      // Always the 1st → last day of the month, current month included
      // (see the comment above computeMonthSeries' own queries) — so
      // getProjectionDetail's line-item fetch always matches exactly
      // what this month's own totals here were summed from.
      fromDate: parseCalendarDate(monthFirstDay(month)),
      toDate: parseCalendarDate(monthLastDay(month)),
      initialBalance,
      currentBalance: isCurrentMonth ? initialBalance + realizedThisMonth : initialBalance,
      projectedBalance: runningBalance,
      incomeForecast,
      accountExpenses,
      cardExpenses,
      loanExpenses,
      totalExpenses,
      status: riskStatusFor(runningBalance, totalExpenses),
    });
  }

  return entries;
}

// User-review-required answers this implements (tasks/016-projections.md):
// 1. Saldo Previsto = running balance — starts from every non-card
//    account's real transaction history up to the start of the current
//    month, then accumulates each FULL month's income minus (account
//    expenses + card invoices due), current month included — its own
//    already-passed days aren't split out separately (see
//    computeMonthSeries' own comment on why).
// 2. "Gasto no cartão" = invoices whose dueDate falls in that month
//    (real cash impact), not purchases made that month.
// 3. Default 6 months ahead, adjustable via the period selector (3/6/12
//    — redesign spec section 4.1) up to MAX_MONTHS_AHEAD.
export async function getProjections(monthsAhead: number) {
  const userId = await requireUserId();
  const series = await computeMonthSeries(userId);
  const clamped = Math.min(Math.max(monthsAhead, 1), MAX_MONTHS_AHEAD);

  // Strips fromDate/toDate — only getProjectionDetail below needs the
  // raw range, to fetch that month's line items.
  return series.slice(0, clamped).map((entry) => ({
    monthKey: entry.monthKey,
    isCurrentMonth: entry.isCurrentMonth,
    initialBalance: entry.initialBalance,
    currentBalance: entry.currentBalance,
    projectedBalance: entry.projectedBalance,
    incomeForecast: entry.incomeForecast,
    accountExpenses: entry.accountExpenses,
    cardExpenses: entry.cardExpenses,
    loanExpenses: entry.loanExpenses,
    totalExpenses: entry.totalExpenses,
    status: entry.status,
  }));
}

// The redesign's dedicated /projections/[monthId] page — itemized
// breakdown for exactly one month, replacing the old inline "Ver
// extrato" link's summary-only view. `monthId` is the same "yyyy-MM"
// key getProjections' entries already carry.
export async function getProjectionDetail(monthId: string) {
  const userId = await requireUserId();
  const t = await getTranslations("scrn-projections");
  const series = await computeMonthSeries(userId);
  const monthIndex = series.findIndex((entry) => entry.monthKey === monthId);
  const month = series[monthIndex];
  if (!month) return null;

  // Adjacent months' own nav buttons on the detail header — the whole
  // horizon is already computed above, so this is just an index lookup,
  // unlike invoices' own previous/next (a separate query, since invoices
  // aren't generated for a fixed-size window the way this series is).
  // null at either edge: the earliest month IS the current month (no
  // "previous" to project before today), and the last one is capped by
  // MAX_MONTHS_AHEAD.
  const previousMonthId = series[monthIndex - 1]?.monthKey ?? null;
  const nextMonthId = series[monthIndex + 1]?.monthKey ?? null;

  const [selfPerson, invoices, transactions, loanInstallments] = await Promise.all([
    // Only feeds the detail page's "Ver extrato completo" link — it
    // passes `?person=` too, so what opens on the transactions screen
    // matches exactly the self-share this page already summed, not
    // everyone's transactions for the month.
    prisma.person.findFirst({
      where: { userId, isSelf: true },
      select: { id: true },
    }),
    prisma.invoice.findMany({
      where: {
        account: { userId, type: "CREDIT_CARD" },
        status: { not: "PAID" },
        dueDate: { gte: month.fromDate, lte: month.toDate },
      },
      include: {
        account: {
          select: {
            name: true,
            cards: {
              select: { lastFourDigits: true },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        },
        transactionInvoices: {
          include: {
            transaction: { select: { amount: true, splits: SPLITS_SELECT } },
          },
        },
        payments: { select: { amount: true } },
        creditsReceived: { select: { amount: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        status: { not: "FAILED" },
        date: { gte: month.fromDate, lte: month.toDate },
        account: { type: { not: "CREDIT_CARD" } },
      },
      select: {
        id: true,
        description: true,
        date: true,
        amount: true,
        splits: SPLITS_SELECT,
        category: { select: { name: true } },
        // Same reasoning as computeMonthSeries' own select above — sorts
        // an invoice-payment settlement into cardsBreakdown below instead
        // of accountsBreakdown, matching how it's already counted in
        // month.cardExpenses/accountExpenses.
        invoicePayment: { select: { id: true } },
        // Same idea for a paid loan installment's own settlement — sorts
        // it into loansBreakdown instead of accountsBreakdown, matching
        // month.loanExpenses.
        loanInstallment: { select: { id: true } },
      },
      orderBy: { date: "asc" },
    }),
    // Same clamping computeMonthSeries' own bucketing loop applies: the
    // current month's detail page also pulls in anything overdue from
    // before this window (`dueDate <= month.toDate`, no lower bound) so
    // its accountsBreakdown total matches month.accountExpenses exactly;
    // any other (future) month only shows what's actually due within its
    // own bounds — nothing can be "overdue" relative to a month that
    // hasn't started yet, since an overdue installment is always
    // bucketed into the CURRENT month instead, never a later one.
    prisma.loanInstallment.findMany({
      where: {
        transactionId: null,
        loan: { userId, person: { isSelf: true } },
        dueDate: month.isCurrentMonth
          ? { lte: month.toDate }
          : { gte: month.fromDate, lte: month.toDate },
      },
      select: {
        id: true,
        dueDate: true,
        amount: true,
        loan: { select: { description: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  // Same self-share rule as computeMonthSeries above — an invoice with
  // zero self-share (every purchase in it belongs to someone else) is
  // left out entirely rather than shown as an R$0,00 row.
  const stillOwedCardsBreakdown = invoices
    .map((invoice) => {
      const selfShareTotal = invoice.transactionInvoices.reduce(
        (sum, ti) =>
          sum +
          Math.abs(
            selfShareAmount(
              ti.transaction.amount.toNumber(),
              toSplitInputs(ti.transaction.splits),
            ),
          ),
        0,
      );
      // Same "scale by what's actually still outstanding" rule as
      // computeMonthSeries' own cardExpenseByMonth above.
      const invoiceTotal = sumInvoiceTransactionsTotal(invoice.transactionInvoices);
      const paidAmount = invoice.payments.reduce(
        (sum, payment) => sum + payment.amount.toNumber(),
        0,
      );
      const creditApplied = invoice.creditsReceived.reduce(
        (sum, credit) => sum + credit.amount.toNumber(),
        0,
      );
      const remainingRatio =
        invoiceTotal > 0
          ? Math.max(0, invoiceTotal - paidAmount - creditApplied) / invoiceTotal
          : 0;

      return {
        id: invoice.id,
        name: invoice.account.name,
        cardLastFourDigits: invoice.account.cards[0]?.lastFourDigits ?? null,
        dueDate: invoice.dueDate,
        amount: selfShareTotal * remainingRatio,
      };
    })
    .filter((item) => item.amount > 0);

  const transactionsWithSelfShare = transactions.map((transaction) => ({
    id: transaction.id,
    name: transaction.description,
    categoryName: transaction.category?.name ?? null,
    date: transaction.date,
    isInvoicePayment: transaction.invoicePayment !== null,
    isLoanInstallment: transaction.loanInstallment !== null,
    selfShare: selfShareAmount(
      transaction.amount.toNumber(),
      toSplitInputs(transaction.splits),
    ),
  }));

  // An invoice-payment settlement is card spending, not a "conta"
  // expense (see computeMonthSeries' own comment on the exact same
  // rule) — folded into cardsBreakdown below instead of accountsBreakdown,
  // dated by when it was actually paid rather than the invoice's own
  // dueDate (there's no invoice-shaped row to hang it on here: the
  // invoice it settles is either PAID already — excluded from `invoices`
  // above — or still open with its own separate row for whatever
  // remains). No cardLastFourDigits: it settles the whole invoice, not
  // one specific physical card on the account.
  const paidCardsBreakdown = transactionsWithSelfShare
    .filter((transaction) => transaction.selfShare < 0 && transaction.isInvoicePayment)
    .map((transaction) => ({
      id: transaction.id,
      name: transaction.name,
      cardLastFourDigits: null,
      dueDate: transaction.date,
      amount: Math.abs(transaction.selfShare),
    }));

  const cardsBreakdown = [...stillOwedCardsBreakdown, ...paidCardsBreakdown].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
  );

  // Own card, own breakdown, never accountsBreakdown — see computeMonthSeries'
  // loanExpenseByMonth comment for why loans get pulled out of "Contas
  // Fixas / Recorrentes" instead of blending into it. Unpaid installments
  // have no Transaction row to read a real category from (see
  // fetchUnpaidSelfLoanInstallments' own comment), so every row here gets
  // the same fixed "Empréstimo" label instead, whether it's still owed or
  // already paid (a paid one's real category is always the seeded
  // "Empréstimo" category anyway, via registerLoanPayment).
  const loansBreakdown = [
    ...loanInstallments.map((installment) => ({
      id: installment.id,
      name: installment.loan.description,
      categoryName: t("detail.sections.loans.categoryLabel"),
      date: installment.dueDate,
      amount: installment.amount.toNumber(),
    })),
    ...transactionsWithSelfShare
      .filter((transaction) => transaction.selfShare < 0 && transaction.isLoanInstallment)
      .map((transaction) => ({
        id: transaction.id,
        name: transaction.name,
        categoryName: t("detail.sections.loans.categoryLabel"),
        date: transaction.date,
        amount: Math.abs(transaction.selfShare),
      })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const accountsBreakdown = transactionsWithSelfShare
    .filter(
      (transaction) =>
        transaction.selfShare < 0 &&
        !transaction.isInvoicePayment &&
        !transaction.isLoanInstallment,
    )
    .map((transaction) => ({
      id: transaction.id,
      name: transaction.name,
      categoryName: transaction.categoryName,
      date: transaction.date,
      amount: Math.abs(transaction.selfShare),
    }));

  const receivablesBreakdown = transactionsWithSelfShare
    .filter((transaction) => transaction.selfShare > 0)
    .map((transaction) => ({
      id: transaction.id,
      name: transaction.name,
      categoryName: transaction.categoryName,
      date: transaction.date,
      amount: transaction.selfShare,
    }));

  return {
    monthKey: month.monthKey,
    previousMonthId,
    nextMonthId,
    selfPersonId: selfPerson?.id ?? null,
    isCurrentMonth: month.isCurrentMonth,
    initialBalance: month.initialBalance,
    projectedBalance: month.projectedBalance,
    incomeForecast: month.incomeForecast,
    accountExpenses: month.accountExpenses,
    cardExpenses: month.cardExpenses,
    loanExpenses: month.loanExpenses,
    totalExpenses: month.totalExpenses,
    status: month.status,
    cardsBreakdown,
    accountsBreakdown,
    loansBreakdown,
    receivablesBreakdown,
  };
}
