"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { parseCalendarDate, todayCalendarDate } from "@/lib/date";
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

// One account plus how its current balance breaks down per Person —
// what the /accounts/[id] detail screen shows. Same "balance is just the
// sum of transactions up to and including today" rule listAccounts
// follows above (future PENDING rows generated by a recurrence never
// count), applied twice here: once over the account as a whole, and once
// over its TransactionSplit rows grouped by person.
//
// The two agree by construction: every split set is scaled to its own
// row's amount when written (resolveSplitsCreateInput, see
// src/lib/transaction-splits.ts), and a transaction with no splits at
// all is implicitly 100% the user's own — the same convention
// projections/_lib/self-share.ts relies on — so those rows are folded
// into the Person marked `isSelf`. A user always has one (created at
// sign-up, see sync-user.ts); the `personId: null` row below only ever
// materializes if that guarantee is somehow broken, so the unattributed
// money still shows up instead of silently vanishing from the breakdown.
export async function getAccountDetail(id: string) {
  const userId = await requireUserId();

  const account = await prisma.account.findFirst({
    where: { id, userId, type: { in: [...accountTypeValues] } },
  });
  if (!account) return null;

  const todayDate = parseCalendarDate(todayCalendarDate());
  const settledWhere = { userId, accountId: id, date: { lte: todayDate } };

  const [people, splitTotals, unattributed, total] = await Promise.all([
    prisma.person.findMany({
      where: { userId },
      select: { id: true, name: true, colorStyle: true, isSelf: true },
      orderBy: { name: "asc" },
    }),
    prisma.transactionSplit.groupBy({
      by: ["personId"],
      where: { transaction: settledWhere },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: { ...settledWhere, splits: { none: {} } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: settledWhere,
      _sum: { amount: true },
    }),
  ]);

  const totalsByPersonId = new Map(
    splitTotals.map((row) => [
      row.personId,
      {
        balance: row._sum.amount?.toNumber() ?? 0,
        transactionsCount: row._count._all,
      },
    ]),
  );

  const unattributedBalance = unattributed._sum.amount?.toNumber() ?? 0;
  const unattributedCount = unattributed._count._all;
  const selfPerson = people.find((person) => person.isSelf) ?? null;

  const peopleBalances = people
    .map((person) => {
      const totals = totalsByPersonId.get(person.id);
      const foldsUnattributed = person.isSelf;
      return {
        personId: person.id as string | null,
        name: person.name,
        colorStyle: person.colorStyle,
        isSelf: person.isSelf,
        balance:
          (totals?.balance ?? 0) + (foldsUnattributed ? unattributedBalance : 0),
        transactionsCount:
          (totals?.transactionsCount ?? 0) +
          (foldsUnattributed ? unattributedCount : 0),
      };
    })
    // Someone with no movement at all on THIS account has nothing to say
    // here — the breakdown lists who actually moved money through it,
    // not the user's whole address book.
    .filter((row) => row.transactionsCount > 0);

  if (!selfPerson && unattributedCount > 0) {
    peopleBalances.push({
      personId: null,
      // Labeled by the screen (`detail.people.unattributed`), not here —
      // no user-facing string is built server-side.
      name: "",
      colorStyle: null,
      isSelf: false,
      balance: unattributedBalance,
      transactionsCount: unattributedCount,
    });
  }

  // Self first (it's the user's own share, the number they look at
  // first), then by how much of the balance each person accounts for.
  peopleBalances.sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    const byWeight = Math.abs(b.balance) - Math.abs(a.balance);
    return byWeight !== 0 ? byWeight : a.name.localeCompare(b.name);
  });

  return {
    id: account.id,
    name: account.name,
    type: account.type,
    status: account.status,
    balance: total._sum.amount?.toNumber() ?? 0,
    people: peopleBalances,
  };
}
