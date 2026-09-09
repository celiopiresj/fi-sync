"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { parseCalendarDate } from "@/lib/date";
import { effectiveDateWhere } from "@/lib/transaction-period";
import { Prisma } from "@/generated/prisma/client";
import {
  budgetSchema,
  budgetGroupSchema,
  type BudgetFormValues,
  type BudgetGroupFormValues,
} from "./_schema/schema";
import { SUGGESTION_MONTHS_COUNT } from "./_constants/constants";

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// Builds the first-day-of-month Date for a given "yyyy-MM" or
// "yyyy-MM-dd" string — used as the `Budget.month` value. Runs through
// `parseCalendarDate` so the date pins to APP_TIME_ZONE, same convention
// as every other date-only value in the app (see AGENTS.md).
function monthDate(monthStr: string): Date {
  // Accept both "yyyy-MM" (from period key) and "yyyy-MM-dd"
  const normalized =
    monthStr.length === 7 ? `${monthStr}-01` : monthStr;
  return parseCalendarDate(normalized);
}

// -----------------------------------------------------------------------
// Read — form options (categories, groups)
// -----------------------------------------------------------------------

export async function getBudgetFormOptions() {
  const userId = await requireUserId();

  const [categories, groups] = await Promise.all([
    prisma.category.findMany({
      where: {
        OR: [{ userId: null }, { userId }],
      },
      select: { id: true, name: true, icon: true, colorStyle: true },
      orderBy: { name: "asc" },
    }),
    prisma.budgetGroup.findMany({
      where: { userId },
      select: { id: true, name: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return { categories, groups };
}

// -----------------------------------------------------------------------
// Read — budget for a specific month, with computed spending per item
// -----------------------------------------------------------------------

export async function getBudgetWithSpending(month: string) {
  const userId = await requireUserId();
  const monthValue = monthDate(month);

  const budget = await prisma.budget.findUnique({
    where: { userId_month: { userId, month: monthValue } },
    include: {
      items: {
        include: {
          category: {
            select: { id: true, name: true, icon: true, colorStyle: true },
          },
          group: { select: { id: true, name: true, sortOrder: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!budget) return null;

  // Compute actual spending for each category in this month. We query
  // ALL transactions in the month at once (not per-category) and then
  // bucket them — one query is better than N.
  const firstDay = monthStr(monthValue);
  const lastDay = lastDayOfMonthStr(monthValue);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      // A card purchase counts toward the month its invoice is DUE, not
      // the month it was bought in — same rule every other period-
      // scoped read in the app follows (listTransactions,
      // getCategoryExpenseBreakdown, getMonthlyBalances; see
      // src/lib/transaction-period.ts's own comment). Previously this
      // used the transaction's own `date` for every account type,
      // meaning a card purchase near the end of the month landed in
      // this month's budget even when its invoice — and the money
      // actually leaving an account — wouldn't be due until next month.
      ...effectiveDateWhere(firstDay, lastDay),
      // Only expenses (negative amounts) count toward budget spending
      amount: { lt: 0 },
    },
    select: { categoryId: true, amount: true },
  });

  // Sum spending by category (amounts are negative, convert to positive)
  const spendingByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.categoryId) continue;
    const current = spendingByCategory.get(tx.categoryId) ?? 0;
    spendingByCategory.set(
      tx.categoryId,
      current + Math.abs(Number(tx.amount)),
    );
  }

  const items = budget.items.map((item) => {
    const spent = spendingByCategory.get(item.categoryId) ?? 0;
    const limit = Number(item.limit);
    const percentage = limit > 0 ? (spent / limit) * 100 : 0;

    return {
      id: item.id,
      categoryId: item.categoryId,
      category: item.category,
      groupId: item.groupId,
      group: item.group,
      limit,
      sortOrder: item.sortOrder,
      spent,
      percentage,
    };
  });

  return {
    id: budget.id,
    month: budget.month,
    expectedIncome: Number(budget.expectedIncome),
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
    items,
  };
}

// -----------------------------------------------------------------------
// Write — create or update budget
// -----------------------------------------------------------------------

type ActionResult = { error?: string };

export async function createBudget(
  month: string,
  values: BudgetFormValues,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = budgetSchema.safeParse(values);
  if (!parsed.success) return { error: "validation" };

  const monthValue = monthDate(month);

  // Check if budget already exists for this month
  const existing = await prisma.budget.findUnique({
    where: { userId_month: { userId, month: monthValue } },
  });
  if (existing) return { error: "already_exists" };

  await prisma.budget.create({
    data: {
      userId,
      month: monthValue,
      expectedIncome: new Prisma.Decimal(parsed.data.expectedIncome),
      items: {
        create: parsed.data.items.map((item, index) => ({
          categoryId: item.categoryId,
          groupId: item.groupId || null,
          limit: new Prisma.Decimal(item.limit),
          sortOrder: index,
        })),
      },
    },
  });

  return {};
}

export async function updateBudget(
  budgetId: string,
  values: BudgetFormValues,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = budgetSchema.safeParse(values);
  if (!parsed.success) return { error: "validation" };

  // Verify ownership
  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
    select: { userId: true },
  });
  if (!budget || budget.userId !== userId) return { error: "not_found" };

  // Delete existing items and recreate — simpler than diffing since the
  // form always sends the full list.
  await prisma.$transaction([
    prisma.budgetItem.deleteMany({ where: { budgetId } }),
    prisma.budget.update({
      where: { id: budgetId },
      data: {
        expectedIncome: new Prisma.Decimal(parsed.data.expectedIncome),
        items: {
          create: parsed.data.items.map((item, index) => ({
            categoryId: item.categoryId,
            groupId: item.groupId || null,
            limit: new Prisma.Decimal(item.limit),
            sortOrder: index,
          })),
        },
      },
    }),
  ]);

  return {};
}

// -----------------------------------------------------------------------
// Write — copy budget from previous month
// -----------------------------------------------------------------------

export async function copyBudgetFromPreviousMonth(
  month: string,
): Promise<ActionResult & { created?: boolean }> {
  const userId = await requireUserId();
  const currentMonthDate = monthDate(month);

  // Find the previous month's date
  const prevDate = new Date(currentMonthDate);
  prevDate.setUTCMonth(prevDate.getUTCMonth() - 1);

  const previousBudget = await prisma.budget.findUnique({
    where: { userId_month: { userId, month: prevDate } },
    include: {
      items: true,
    },
  });

  if (!previousBudget) return { error: "no_previous" };

  // Check if target month already has a budget
  const existing = await prisma.budget.findUnique({
    where: { userId_month: { userId, month: currentMonthDate } },
  });
  if (existing) return { error: "already_exists" };

  await prisma.budget.create({
    data: {
      userId,
      month: currentMonthDate,
      expectedIncome: previousBudget.expectedIncome,
      items: {
        create: previousBudget.items.map((item) => ({
          categoryId: item.categoryId,
          groupId: item.groupId,
          limit: item.limit,
          sortOrder: item.sortOrder,
        })),
      },
    },
  });

  return { created: true };
}

// -----------------------------------------------------------------------
// Write — suggest budget limits from spending history
// -----------------------------------------------------------------------

export type SuggestedLimit = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  averageSpent: number;
};

export async function suggestBudgetLimits(): Promise<
  ActionResult & { suggestions?: SuggestedLimit[] }
> {
  const userId = await requireUserId();

  // Look back N months from current date
  const now = new Date();
  const startDate = new Date(now);
  startDate.setUTCMonth(startDate.getUTCMonth() - SUGGESTION_MONTHS_COUNT);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: startDate },
      amount: { lt: 0 }, // Only expenses
      categoryId: { not: null },
    },
    select: { categoryId: true, amount: true },
  });

  if (transactions.length === 0) {
    return { error: "no_history" };
  }

  // Sum spending by category, then divide by number of months
  const spendingByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.categoryId) continue;
    const current = spendingByCategory.get(tx.categoryId) ?? 0;
    spendingByCategory.set(
      tx.categoryId,
      current + Math.abs(Number(tx.amount)),
    );
  }

  // Fetch category names
  const categoryIds = [...spendingByCategory.keys()];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, icon: true },
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const suggestions: SuggestedLimit[] = categoryIds
    .map((categoryId) => {
      const category = categoryMap.get(categoryId);
      if (!category) return null;
      const totalSpent = spendingByCategory.get(categoryId) ?? 0;
      // Round up to nearest 10 for cleaner suggested limits
      const average = totalSpent / SUGGESTION_MONTHS_COUNT;
      const roundedUp = Math.ceil(average / 10) * 10;
      return {
        categoryId,
        categoryName: category.name,
        categoryIcon: category.icon,
        averageSpent: roundedUp,
      };
    })
    .filter((s): s is SuggestedLimit => s !== null)
    .sort((a, b) => b.averageSpent - a.averageSpent);

  return { suggestions };
}

// -----------------------------------------------------------------------
// Budget Groups — CRUD
// -----------------------------------------------------------------------

export async function listBudgetGroups() {
  const userId = await requireUserId();
  return prisma.budgetGroup.findMany({
    where: { userId },
    select: { id: true, name: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createBudgetGroup(
  values: BudgetGroupFormValues,
): Promise<ActionResult & { id?: string }> {
  const userId = await requireUserId();
  const parsed = budgetGroupSchema.safeParse(values);
  if (!parsed.success) return { error: "validation" };

  // Get max sortOrder for new group
  const maxSort = await prisma.budgetGroup.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });

  const group = await prisma.budgetGroup.create({
    data: {
      userId,
      name: parsed.data.name,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return { id: group.id };
}

export async function updateBudgetGroup(
  groupId: string,
  values: BudgetGroupFormValues,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = budgetGroupSchema.safeParse(values);
  if (!parsed.success) return { error: "validation" };

  const group = await prisma.budgetGroup.findUnique({
    where: { id: groupId },
    select: { userId: true },
  });
  if (!group || group.userId !== userId) return { error: "not_found" };

  await prisma.budgetGroup.update({
    where: { id: groupId },
    data: { name: parsed.data.name },
  });

  return {};
}

export async function deleteBudgetGroup(
  groupId: string,
): Promise<ActionResult> {
  const userId = await requireUserId();

  const group = await prisma.budgetGroup.findUnique({
    where: { id: groupId },
    select: { userId: true },
  });
  if (!group || group.userId !== userId) return { error: "not_found" };

  // BudgetItems referencing this group will have groupId set to null
  // (onDelete: SetNull in the schema)
  await prisma.budgetGroup.delete({ where: { id: groupId } });

  return {};
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

// Format a Date as "yyyy-MM-dd" for use in Prisma date queries. Uses UTC
// getters because Budget.month (like all @db.Date columns) comes back as
// UTC midnight — see the note in src/lib/date.ts.
function monthStr(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function lastDayOfMonthStr(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthPadded = String(month + 1).padStart(2, "0");
  return `${year}-${monthPadded}-${String(lastDay).padStart(2, "0")}`;
}
