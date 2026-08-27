"use server";

import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { parseCalendarDate, todayCalendarDate } from "@/lib/date";
import { listAccounts } from "../accounts/actions";
import { listInvestmentAccounts } from "../investments/actions";
import { listCreditCardAccounts } from "../cards/actions";
import { listInvoices } from "../invoices/actions";
import { getBudgetWithSpending } from "../budgets/actions";
import { listRecurrences } from "../recurrences/actions";
import { currentPeriod, periodRange, shiftPeriod, type Period } from "../transactions/_lib/period";
import { formatMonthAbbreviationPtBr } from "../transactions/_lib/format-month-label";

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// The chart's trailing window (12 months, client toggles between showing
// all of it or just the last 6 — see home-balance-chart.tsx) and how many
// recent transactions/top categories to surface.
const TREND_MONTHS = 12;
const RECENT_TRANSACTIONS_COUNT = 5;

// "Everyday cash flow" account scope shared by every income/expense sum
// below — credit card activity is tracked via invoices instead, and
// investment/pocket movements (aporte/resgate) are money moving between
// the user's own buckets, not earned income or a household expense, so
// counting either here would inflate/distort these figures even though
// both are perfectly real Transaction rows elsewhere in the app.
const CASH_FLOW_ACCOUNT_TYPES = ["CREDIT_CARD", "INVESTMENT", "POCKET"] as const;

// The one screen whose entire purpose is aggregating every other domain —
// deliberately reaches across routes and calls their own exported actions
// (listAccounts, listInvoices, getBudgetWithSpending, ...) directly rather
// than duplicating each domain's balance/usage/spending logic locally.
// That duplication is the norm elsewhere in this app specifically to keep
// PEER routes independently evolvable (see e.g. invoices/actions.ts's own
// comment on not importing cards/actions.ts) — it doesn't apply the same
// way here, since a dashboard depending on every leaf domain is exactly
// what it's for, and the dependency only ever flows one direction (leaves
// → here, never back).
export async function getHomeOverview() {
  const userId = await requireUserId();
  const t = await getTranslations("scrn-home");
  const todayDate = parseCalendarDate(todayCalendarDate());
  const period = currentPeriod();
  const monthStartDate = parseCalendarDate(periodRange(period).from);
  const currentMonthKey = todayCalendarDate().slice(0, 7);

  const trendPeriods = Array.from({ length: TREND_MONTHS }, (_, index) =>
    shiftPeriod(period, index - (TREND_MONTHS - 1)),
  );

  const [
    accounts,
    investmentAccounts,
    cardAccounts,
    invoices,
    budget,
    recurrences,
    trendSums,
    categoryGroups,
    recentTransactions,
  ] = await Promise.all([
    listAccounts(),
    listInvestmentAccounts(),
    listCreditCardAccounts(),
    listInvoices(),
    getBudgetWithSpending(currentMonthKey),
    listRecurrences(),
    Promise.all(
      trendPeriods.map((trendPeriod: Period, index: number) => {
        const { from, to } = periodRange(trendPeriod);
        // Every period here is <= the current month by construction; only
        // the LAST one (the current month itself) can still have
        // not-yet-elapsed days, so only it gets capped at today instead
        // of the month's own last day — same "no future-dated
        // transaction counts" rule as everywhere else in this app.
        const isCurrentMonth = index === trendPeriods.length - 1;
        const where = {
          userId,
          account: { type: { notIn: [...CASH_FLOW_ACCOUNT_TYPES] } },
          date: {
            gte: parseCalendarDate(from),
            lte: isCurrentMonth ? todayDate : parseCalendarDate(to),
          },
        };
        return Promise.all([
          prisma.transaction.aggregate({
            where: { ...where, amount: { gt: 0 } },
            _sum: { amount: true },
          }),
          prisma.transaction.aggregate({
            where: { ...where, amount: { lt: 0 } },
            _sum: { amount: true },
          }),
        ]);
      }),
    ),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, amount: { lt: 0 }, date: { gte: monthStartDate, lte: todayDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { userId, date: { lte: todayDate } },
      orderBy: { date: "desc" },
      take: RECENT_TRANSACTIONS_COUNT,
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        category: { select: { name: true, icon: true, colorStyle: true } },
        account: { select: { name: true } },
      },
    }),
  ]);

  const monthlyTrend = trendPeriods.map((trendPeriod, index) => ({
    month: `${trendPeriod.year}-${pad2(trendPeriod.month + 1)}`,
    monthLabel: formatMonthAbbreviationPtBr(trendPeriod.month),
    income: trendSums[index]![0]._sum.amount?.toNumber() ?? 0,
    expenses: Math.abs(trendSums[index]![1]._sum.amount?.toNumber() ?? 0),
  }));

  const currentMonthTrend = monthlyTrend[monthlyTrend.length - 1]!;
  const previousMonthTrend = monthlyTrend[monthlyTrend.length - 2];
  const monthIncome = currentMonthTrend.income;
  const monthExpenses = currentMonthTrend.expenses;

  // null (not 0) when there's no prior month to compare against, or it
  // was itself zero — the UI hides the trend pill rather than showing a
  // misleading "+Infinity%"/"0%".
  const incomeChangePercent =
    previousMonthTrend && previousMonthTrend.income > 0
      ? ((monthIncome - previousMonthTrend.income) / previousMonthTrend.income) * 100
      : null;

  const budgetTotalLimit = budget
    ? budget.items.reduce((sum, item) => sum + item.limit, 0)
    : 0;
  const expensesVsBudgetPercent =
    budgetTotalLimit > 0 ? ((monthExpenses - budgetTotalLimit) / budgetTotalLimit) * 100 : null;

  const totalBalance =
    accounts.reduce((sum, account) => sum + account.balance, 0) +
    investmentAccounts.reduce((sum, account) => sum + account.balance, 0);

  const invoicesDue = invoices
    .filter((invoice) => invoice.displayStatus !== "PAID")
    .reduce((sum, invoice) => sum + invoice.remainingDue, 0);

  const closedInvoices = invoices.filter(
    (invoice) => invoice.displayStatus === "CLOSED" || invoice.displayStatus === "PARTIALLY_PAID",
  );
  const closedInvoicesTotal = closedInvoices.reduce(
    (sum, invoice) => sum + invoice.remainingDue,
    0,
  );

  const highUsageCards = cardAccounts
    .filter((account) => account.usagePercent >= 95)
    .map((account) => ({ name: account.name, usagePercent: account.usagePercent }));

  const overBudgetCategories = budget
    ? budget.items
        .filter((item) => item.spent > item.limit)
        .map((item) => ({
          name: item.category.name,
          overAmount: item.spent - item.limit,
        }))
    : [];

  const recurrencesNeedingExtension = recurrences
    .filter((recurrence) => recurrence.needsExtension)
    .map((recurrence) => ({ description: recurrence.description }));

  // categoryGroups only has `categoryId` + sum — resolve names/icon/color
  // in a single follow-up query rather than one per group.
  const categoryIds = categoryGroups
    .map((group) => group.categoryId)
    .filter((id): id is string => id !== null);
  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, icon: true, colorStyle: true },
      })
    : [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const uncategorizedLabel = t("categoryBreakdown.uncategorized");

  const categoryBreakdownItems = categoryGroups
    .map((group) => {
      const category = group.categoryId ? categoryById.get(group.categoryId) : undefined;
      return {
        id: group.categoryId ?? "uncategorized",
        name: category?.name ?? uncategorizedLabel,
        icon: category?.icon ?? null,
        colorStyle: category?.colorStyle ?? null,
        total: Math.abs(group._sum.amount?.toNumber() ?? 0),
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
  const categoryBreakdownTotal = categoryBreakdownItems.reduce(
    (sum, item) => sum + item.total,
    0,
  );

  return {
    totalBalance,
    monthIncome,
    monthExpenses,
    invoicesDue,
    netChangeThisMonth: monthIncome - monthExpenses,
    incomeChangePercent,
    expensesVsBudgetPercent,
    monthlyTrend,
    categoryBreakdown: { items: categoryBreakdownItems, totalExpenses: categoryBreakdownTotal },
    recentTransactions: recentTransactions.map((transaction) => ({
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount.toNumber(),
      date: transaction.date,
      categoryName: transaction.category?.name ?? null,
      categoryIcon: transaction.category?.icon ?? null,
      categoryColorStyle: transaction.category?.colorStyle ?? null,
      accountName: transaction.account.name,
    })),
    attention: {
      closedInvoicesCount: closedInvoices.length,
      closedInvoicesTotal,
      highUsageCards,
      overBudgetCategories,
      recurrencesNeedingExtension,
    },
  };
}
