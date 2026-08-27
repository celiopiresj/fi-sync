"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { parseCalendarDate, todayCalendarDate } from "@/lib/date";
import {
  investmentAccountSchema,
  investmentAccountTypeValues,
  investmentMovementSchema,
  type InvestmentAccountFormValues,
  type InvestmentMovementFormValues,
} from "./_schema/schema";

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// Every investment/pocket account for the user, including inactive ones
// (this screen is where you'd reactivate one). Checking/savings/cash
// (accounts/actions.ts) and credit card (cards/actions.ts) accounts exist
// in the same Prisma model but are out of scope here and never returned.
//
// `balance` isn't a stored column — same groupBy pattern as accounts/
// actions.ts's own listAccounts, `date: { lte: todayDate }` for the same
// reason: a recurrence can generate real, already-persisted PENDING
// Transaction rows dated in the future, and those must never count
// toward a "current balance" figure.
export async function listInvestmentAccounts() {
  const userId = await requireUserId();
  const todayDate = parseCalendarDate(todayCalendarDate());

  const [accounts, sums] = await Promise.all([
    prisma.account.findMany({
      where: { userId, type: { in: [...investmentAccountTypeValues] } },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { userId, date: { lte: todayDate } },
      _sum: { amount: true },
    }),
  ]);

  const balanceByAccountId = new Map(
    sums.map((sum) => [sum.accountId, sum._sum.amount?.toNumber() ?? 0]),
  );

  return accounts.map((account) => ({
    ...account,
    balance: balanceByAccountId.get(account.id) ?? 0,
  }));
}

async function validateInvestmentAccount(data: InvestmentAccountFormValues) {
  return investmentAccountSchema.safeParse(data);
}

export async function createInvestmentAccount(data: InvestmentAccountFormValues) {
  const userId = await requireUserId();
  const result = await validateInvestmentAccount(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;

  await prisma.account.create({
    data: {
      userId,
      name: value.name,
      type: value.type,
    },
  });

  revalidatePath("/investments");
  return { error: null };
}

export async function updateInvestmentAccount(
  id: string,
  data: InvestmentAccountFormValues,
) {
  const userId = await requireUserId();
  const result = await validateInvestmentAccount(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;

  const existing = await prisma.account.findUnique({ where: { id, userId } });
  if (!existing) {
    return { error: "Not found" };
  }

  await prisma.account.update({
    where: { id },
    data: {
      name: value.name,
      type: value.type,
    },
  });

  revalidatePath("/investments");
  return { error: null };
}

// Hard delete — cascades to every Transaction on this account (see
// prisma/schema.prisma, Transaction.account onDelete: Cascade).
// `toggleInvestmentAccountStatus` (archive) is the non-destructive
// alternative the UI leads with; this is for accounts the user genuinely
// wants gone, history included.
export async function deleteInvestmentAccount(id: string) {
  const userId = await requireUserId();

  await prisma.account.deleteMany({ where: { id, userId } });

  revalidatePath("/investments");
  return { error: null };
}

export async function toggleInvestmentAccountStatus(id: string) {
  const userId = await requireUserId();

  const existing = await prisma.account.findUnique({ where: { id, userId } });
  if (!existing) {
    return { error: "Not found" };
  }

  await prisma.account.update({
    where: { id },
    data: { status: existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
  });

  revalidatePath("/investments");
  return { error: null };
}

// Aporte/rendimento (positive) or resgate (negative) against one
// investment/pocket account — a plain Transaction, no splits/payment
// method/category (none of those apply to a personal investment
// movement). `kind` decides the sign, the default description when the
// user leaves that field blank, AND is persisted onto the Transaction's
// own `investmentMovementKind` — that's what lets
// getInvestmentAccountDetail below sum/list rendimentos reliably,
// instead of guessing from description text.
export async function createInvestmentMovement(
  accountId: string,
  data: InvestmentMovementFormValues,
) {
  const userId = await requireUserId();
  const result = investmentMovementSchema.safeParse(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId, type: { in: [...investmentAccountTypeValues] } },
  });
  if (!account) {
    return { error: "Not found" };
  }

  const t = await getTranslations("scrn-investments");
  const description =
    value.description.trim() ||
    t(`movement.defaultDescription.${value.kind.toLowerCase()}`);

  let amount: number;
  if (value.kind === "YIELD") {
    // For YIELD, `value.amount` isn't the yield itself — it's the
    // account's current total value, as read off the user's own
    // statement (easier to know than the exact yield amount, especially
    // with several small credits over the period). The actual posted
    // transaction is the difference between that and what this account
    // already sums to today — same groupBy-sum-up-to-today rule
    // listInvestmentAccounts uses for its own `balance`, recomputed
    // fresh here rather than trusting a client-sent figure.
    const todayDate = parseCalendarDate(todayCalendarDate());
    const sum = await prisma.transaction.aggregate({
      where: { userId, accountId, date: { lte: todayDate } },
      _sum: { amount: true },
    });
    const currentBalance = sum._sum.amount?.toNumber() ?? 0;
    amount = Math.round((value.amount - currentBalance) * 100) / 100;

    if (Math.abs(amount) < 0.01) {
      return { error: t("movement.errors.noChange") };
    }
  } else {
    amount = value.kind === "WITHDRAWAL" ? -value.amount : value.amount;
  }

  await prisma.transaction.create({
    data: {
      userId,
      accountId,
      description,
      amount,
      date: parseCalendarDate(value.date),
      investmentMovementKind: value.kind,
    },
  });

  revalidatePath("/investments");
  revalidatePath(`/investments/${accountId}`);
  // The movement is also a plain Transaction row, so it shows up there
  // too — same "revalidate /transactions on any new transaction" rule
  // transactions/actions.ts's own revalidateTransactions() follows.
  revalidatePath("/transactions");
  return { error: null };
}

// One account's full movement history + yield stats — feeds
// /investments/[id]. `balance` mirrors listInvestmentAccounts' own
// calculation (every Transaction on the account up to today, not just
// the ones tagged with investmentMovementKind) so the two screens never
// disagree on the account's current balance. `movements` is scoped to
// investmentMovementKind != null — a manually-imported or otherwise
// untagged Transaction on this account (shouldn't normally happen, but
// isn't impossible) still counts toward `balance` without showing up in
// this list, same "list is a curated view, balance is the real sum"
// split invoices/actions.ts's own getInvoiceDetail follows for its total
// vs. its transaction list.
export async function getInvestmentAccountDetail(id: string) {
  const userId = await requireUserId();

  const account = await prisma.account.findFirst({
    where: { id, userId, type: { in: [...investmentAccountTypeValues] } },
  });
  if (!account) return null;

  const todayDate = parseCalendarDate(todayCalendarDate());
  // First/last day of the calendar month before the current one — "mês
  // anterior ao atual", not a rolling 30 days. Built off todayCalendarDate's
  // own "yyyy-MM-dd" digits (same approach as invoices/_lib/period.ts's
  // currentInvoicePeriod), never a raw `new Date(...)`, so this can't
  // drift a day depending on the server process's own timezone. Computed
  // locally rather than importing that file's helper, per this app's
  // per-route self-containment convention.
  const pad2 = (value: number) => String(value).padStart(2, "0");
  const [todayYear, todayMonth] = todayCalendarDate().split("-").map(Number) as [
    number,
    number,
  ];
  const lastMonthYear = todayMonth === 1 ? todayYear - 1 : todayYear;
  const lastMonth = todayMonth === 1 ? 12 : todayMonth - 1;
  const lastMonthLastDay = new Date(lastMonthYear, lastMonth, 0).getDate();
  const lastMonthFrom = parseCalendarDate(`${lastMonthYear}-${pad2(lastMonth)}-01`);
  const lastMonthTo = parseCalendarDate(
    `${lastMonthYear}-${pad2(lastMonth)}-${pad2(lastMonthLastDay)}`,
  );

  const [balanceSum, movements, yieldLastMonthSum, yieldTotalSum] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, accountId: id, date: { lte: todayDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { userId, accountId: id, investmentMovementKind: { not: null } },
      select: { id: true, description: true, amount: true, date: true, investmentMovementKind: true },
      orderBy: { date: "desc" },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        accountId: id,
        investmentMovementKind: "YIELD",
        date: { gte: lastMonthFrom, lte: lastMonthTo },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, accountId: id, investmentMovementKind: "YIELD" },
      _sum: { amount: true },
    }),
  ]);

  return {
    id: account.id,
    name: account.name,
    type: account.type,
    status: account.status,
    balance: balanceSum._sum.amount?.toNumber() ?? 0,
    yieldLastMonth: yieldLastMonthSum._sum.amount?.toNumber() ?? 0,
    yieldTotal: yieldTotalSum._sum.amount?.toNumber() ?? 0,
    movements: movements.map((movement) => ({
      id: movement.id,
      description: movement.description,
      amount: movement.amount.toNumber(),
      date: movement.date,
      // Guaranteed present: the query above only pulled rows where
      // investmentMovementKind is not null.
      kind: movement.investmentMovementKind!,
    })),
  };
}
