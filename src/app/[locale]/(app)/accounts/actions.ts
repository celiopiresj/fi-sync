"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { parseCalendarDate, todayCalendarDate } from "@/lib/date";
import { getAccountPeopleBalances } from "@/lib/account-balance";
import {
  accountSchema,
  accountTypeValues,
  type AccountFormValues,
} from "./_schema/schema";

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// Every checking/savings/cash account for the user, including inactive
// ones (this screen is where you'd reactivate one — the "hide inactive"
// rule only applies to the transaction form's account picker, see
// transactions/_components/transactions-view.tsx). Credit Card
// (tasks/008) and Investment/Pocket (tasks/009) accounts exist in the
// same Prisma model but are out of scope here and never returned.
//
// `balance` isn't a stored column (see prisma/schema.prisma's note on
// Account) — it's the sum of every Transaction on that account up to and
// including today, computed in the database via groupBy (same pattern as
// getMonthlyBalances in transactions/actions.ts) rather than pulled
// client-side, then converted from Decimal to number once at this read
// boundary. `date: { lte: todayDate }` is deliberate, not incidental — a
// recurrence can generate real, already-persisted PENDING Transaction
// rows dated in the future (see recurrences/actions.ts), and those must
// never count toward a "current balance" figure, same rule
// projections/actions.ts's computeMonthSeries follows for its own
// past-balance sum.
export async function listAccounts() {
  const userId = await requireUserId();
  const todayDate = parseCalendarDate(todayCalendarDate());

  const [accounts, sums, openingBalances] = await Promise.all([
    prisma.account.findMany({
      where: { userId, type: { in: [...accountTypeValues] } },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { userId, date: { lte: todayDate } },
      _sum: { amount: true },
    }),
    // At most one per account — see Transaction.isInitialBalance's own
    // comment in schema.prisma. Surfaced separately from `balance` so the
    // account card can show "what you started with" alongside "what it is
    // now" without the two being confused for each other.
    prisma.transaction.findMany({
      where: { userId, isInitialBalance: true },
      select: { accountId: true, amount: true },
    }),
  ]);

  const balanceByAccountId = new Map(
    sums.map((sum) => [sum.accountId, sum._sum.amount?.toNumber() ?? 0]),
  );
  const initialBalanceByAccountId = new Map(
    openingBalances.map((row) => [row.accountId, row.amount.toNumber()]),
  );

  return accounts.map((account) => ({
    ...account,
    balance: balanceByAccountId.get(account.id) ?? 0,
    initialBalance: initialBalanceByAccountId.get(account.id) ?? null,
  }));
}

async function validateAccount(data: AccountFormValues) {
  return accountSchema.safeParse(data);
}

// Creates/updates/removes the account's single isInitialBalance
// Transaction to match `initialBalance` (null = no opening transaction).
// Shared by createAccount and updateAccount so editing an account later
// can adjust or clear the same figure instead of only setting it once at
// creation.
async function syncInitialBalanceTransaction(
  userId: string,
  accountId: string,
  initialBalance: number | null,
) {
  const existing = await prisma.transaction.findFirst({
    where: { userId, accountId, isInitialBalance: true },
  });

  if (initialBalance === null) {
    if (existing) {
      await prisma.transaction.delete({ where: { id: existing.id } });
      revalidatePath("/transactions");
    }
    return;
  }

  if (existing) {
    if (existing.amount.toNumber() !== initialBalance) {
      await prisma.transaction.update({
        where: { id: existing.id },
        data: { amount: initialBalance },
      });
      revalidatePath("/transactions");
    }
    return;
  }

  const t = await getTranslations("scrn-accounts");
  await prisma.transaction.create({
    data: {
      userId,
      accountId,
      description: t("fields.initialBalance.transactionDescription"),
      amount: initialBalance,
      date: parseCalendarDate(todayCalendarDate()),
      isInitialBalance: true,
    },
  });
  revalidatePath("/transactions");
}

export async function createAccount(data: AccountFormValues) {
  const userId = await requireUserId();
  const result = await validateAccount(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;

  const account = await prisma.account.create({
    data: {
      userId,
      name: value.name,
      type: value.type,
    },
  });

  await syncInitialBalanceTransaction(userId, account.id, value.initialBalance);

  revalidatePath("/accounts");
  return { error: null };
}

export async function updateAccount(id: string, data: AccountFormValues) {
  const userId = await requireUserId();
  const result = await validateAccount(data);

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

  await syncInitialBalanceTransaction(userId, id, value.initialBalance);

  revalidatePath("/accounts");
  return { error: null };
}

// Hard delete — cascades to every Transaction on this account (see
// prisma/schema.prisma, Transaction.account onDelete: Cascade).
// `toggleAccountStatus` (archive) is the non-destructive alternative the
// UI leads with; this is for accounts the user genuinely wants gone,
// history included.
export async function deleteAccount(id: string) {
  const userId = await requireUserId();

  await prisma.account.deleteMany({ where: { id, userId } });

  revalidatePath("/accounts");
  return { error: null };
}

export async function toggleAccountStatus(id: string) {
  const userId = await requireUserId();

  const existing = await prisma.account.findUnique({ where: { id, userId } });
  if (!existing) {
    return { error: "Not found" };
  }

  await prisma.account.update({
    where: { id },
    data: { status: existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
  });

  revalidatePath("/accounts");
  return { error: null };
}

// Marks (or, clicked again, unmarks) this account as the one every form
// with an account field preselects — see Account.isDefault's own comment
// in prisma/schema.prisma. At most one true per user, enforced here
// (not a DB constraint): unsetting whichever OTHER account currently
// holds it and this one in the same transaction is what keeps that
// invariant, since nothing stops two plain sequential updates from both
// succeeding with two accounts left true.
export async function toggleDefaultAccount(id: string) {
  const userId = await requireUserId();

  const existing = await prisma.account.findUnique({ where: { id, userId } });
  if (!existing) {
    return { error: "Not found" };
  }

  await prisma.$transaction([
    prisma.account.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    }),
    ...(existing.isDefault
      ? []
      : [prisma.account.update({ where: { id }, data: { isDefault: true } })]),
  ]);

  // Every screen that preselects an account reads it from its own
  // options-fetch (getTransactionFormOptions, getRecurrenceFormOptions,
  // getPayableAccounts, getLoanFormOptions, listTransferAccounts) —
  // revalidate all of them so the new default takes effect without
  // requiring a hard refresh.
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/recurrences");
  revalidatePath("/invoices");
  revalidatePath("/loans");
  revalidatePath("/investments");
  return { error: null };
}

// One account plus how its current balance breaks down per Person —
// what the /accounts/[id] detail screen shows. The numbers themselves
// come from src/lib/account-balance.ts, shared with the balance transfer
// that moves them (transactions/actions.ts's createTransfer), so what
// this screen shows and what that moves can't disagree.
export async function getAccountDetail(id: string) {
  const userId = await requireUserId();

  const account = await prisma.account.findFirst({
    where: { id, userId, type: { in: [...accountTypeValues] } },
  });
  if (!account) return null;

  const { balance, people } = await getAccountPeopleBalances(userId, id);

  return {
    id: account.id,
    name: account.name,
    type: account.type,
    status: account.status,
    balance,
    people,
  };
}
