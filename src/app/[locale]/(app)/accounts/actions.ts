"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
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
// Account) — it's the sum of every Transaction on that account, computed
// in the database via groupBy (same pattern as getMonthlyBalances in
// transactions/actions.ts) rather than pulled client-side, then converted
// from Decimal to number once at this read boundary.
export async function listAccounts() {
  const userId = await requireUserId();

  const [accounts, sums] = await Promise.all([
    prisma.account.findMany({
      where: { userId, type: { in: [...accountTypeValues] } },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { userId },
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

async function validateAccount(data: AccountFormValues) {
  return accountSchema.safeParse(data);
}

export async function createAccount(data: AccountFormValues) {
  const userId = await requireUserId();
  const result = await validateAccount(data);

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
