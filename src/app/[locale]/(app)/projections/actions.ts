"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { sumInvoiceTransactionsTotal } from "@/lib/invoice-total";
import {
  dateOnlyKey,
  parseCalendarDate,
  todayCalendarDate,
  toAppZoned,
} from "@/lib/date";
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
  projectedBalance: number;
  incomeForecast: number;
  accountExpenses: number;
  cardExpenses: number;
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
  const todayStr = todayCalendarDate();
  const todayDate = parseCalendarDate(todayStr);
  const zonedToday = toAppZoned(new Date());
  const currentMonth: ProjectionMonth = {
    year: zonedToday.getFullYear(),
    month: zonedToday.getMonth(),
  };
  const horizonEndDate = parseCalendarDate(
    monthLastDay(addMonths(currentMonth, MAX_MONTHS_AHEAD - 1)),
  );

  // Saldo atual: Account has no stored balance field (tasks/016's own
  // open question 1) — the only source of truth is summing every
  // non-credit-card transaction dated up to and including today.
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
      date: { lte: todayDate },
      account: { type: { not: "CREDIT_CARD" } },
    },
    select: { amount: true, splits: SPLITS_SELECT },
  });

  // Every future non-card transaction and every future card invoice in
  // one query each (not one query per month — same "one query, bucket
  // in JS" shape budgets/actions.ts's getBudgetWithSpending uses for its
  // own per-category spending). `date: { gt: todayDate }` (strictly
  // after, not >=) so today's own transactions — already folded into
  // pastTransactions above — aren't double-counted here.
  const [futureTransactions, futureInvoices] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
        status: { not: "FAILED" },
        date: { gt: todayDate, lte: horizonEndDate },
        account: { type: { not: "CREDIT_CARD" } },
      },
      select: { date: true, amount: true, splits: SPLITS_SELECT },
    }),
    prisma.invoice.findMany({
      where: {
        account: { userId, type: "CREDIT_CARD" },
        status: { not: "PAID" },
        dueDate: { gte: todayDate, lte: horizonEndDate },
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
  for (const transaction of futureTransactions) {
    const key = dateOnlyKey(transaction.date).slice(0, 7);
    const amount = selfShareAmount(
      transaction.amount.toNumber(),
      toSplitInputs(transaction.splits),
    );
    if (amount >= 0) {
      incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + amount);
    } else {
      accountExpenseByMonth.set(
        key,
        (accountExpenseByMonth.get(key) ?? 0) + Math.abs(amount),
      );
    }
  }

  const cardExpenseByMonth = new Map<string, number>();
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
    const totalExpenses = accountExpenses + cardExpenses;

    const initialBalance = runningBalance;
    runningBalance = runningBalance + incomeForecast - totalExpenses;

    entries.push({
      monthKey: key,
      isCurrentMonth,
      // The first bucket only covers "today → end of month": days up to
      // and including yesterday are already folded into pastSum/
      // initialBalance above, so starting it at the 1st would double
      // them.
      fromDate: isCurrentMonth ? todayDate : parseCalendarDate(monthFirstDay(month)),
      toDate: parseCalendarDate(monthLastDay(month)),
      initialBalance,
      projectedBalance: runningBalance,
      incomeForecast,
      accountExpenses,
      cardExpenses,
      totalExpenses,
      status: riskStatusFor(runningBalance, totalExpenses),
    });
  }

  return entries;
}

// User-review-required answers this implements (tasks/016-projections.md):
// 1. Saldo Previsto = running balance — starts from every non-card
//    account's real transaction history up to today, then accumulates
//    each month's income minus (account expenses + card invoices due).
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
    projectedBalance: entry.projectedBalance,
    incomeForecast: entry.incomeForecast,
    accountExpenses: entry.accountExpenses,
    cardExpenses: entry.cardExpenses,
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
  const series = await computeMonthSeries(userId);
  const month = series.find((entry) => entry.monthKey === monthId);
  if (!month) return null;

  const [selfPerson, invoices, transactions] = await Promise.all([
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
      },
      orderBy: { date: "asc" },
    }),
  ]);

  // Same self-share rule as computeMonthSeries above — an invoice with
  // zero self-share (every purchase in it belongs to someone else) is
  // left out entirely rather than shown as an R$0,00 row.
  const cardsBreakdown = invoices
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
    selfShare: selfShareAmount(
      transaction.amount.toNumber(),
      toSplitInputs(transaction.splits),
    ),
  }));

  const accountsBreakdown = transactionsWithSelfShare
    .filter((transaction) => transaction.selfShare < 0)
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
    selfPersonId: selfPerson?.id ?? null,
    isCurrentMonth: month.isCurrentMonth,
    initialBalance: month.initialBalance,
    projectedBalance: month.projectedBalance,
    incomeForecast: month.incomeForecast,
    accountExpenses: month.accountExpenses,
    cardExpenses: month.cardExpenses,
    totalExpenses: month.totalExpenses,
    status: month.status,
    cardsBreakdown,
    accountsBreakdown,
    receivablesBreakdown,
  };
}
