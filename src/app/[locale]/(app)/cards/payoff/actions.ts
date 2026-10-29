"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { dateOnlyKey, todayCalendarDate } from "@/lib/date";
import { formatPersonName } from "@/lib/format-person-name";
import {
  cardPayoffFiltersSchema,
  type CardPayoffFilters,
} from "./_schema/schema";
import { DEFAULT_SCOPE } from "./_constants/constants";
import { computeCardPayoff } from "./_lib/compute-payoff";
import { toCents } from "./_lib/cents";

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

const SPLITS_SELECT = { select: { personId: true, amount: true } } as const;

// The filter Selects' options. Every credit card (an archived one can
// still have installments left to pay), and every person — the user's
// own first.
export async function getCardPayoffOptions() {
  const userId = await requireUserId();

  const [cards, people] = await Promise.all([
    prisma.account.findMany({
      where: { userId, type: "CREDIT_CARD" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.person.findMany({
      where: { userId },
      select: { id: true, name: true, isSelf: true },
      orderBy: [{ isSelf: "desc" }, { name: "asc" }],
    }),
  ]);

  return {
    cards,
    people: people.map((person) => ({ ...person, name: formatPersonName(person.name) })),
  };
}

// How much it takes to pay the cards off — see computeCardPayoff for the
// rules. Reads every unpaid invoice (any due month, so the screen also
// knows the range its "a partir de" stepper can move over) and hands the
// calculation plain integer cents.
export async function getCardPayoff(filters: CardPayoffFilters = {}) {
  const userId = await requireUserId();
  const parsed = cardPayoffFiltersSchema.safeParse(filters);
  const value = parsed.success ? parsed.data : {};

  const [invoices, people] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: { not: "PAID" },
        account: {
          userId,
          type: "CREDIT_CARD",
          ...(value.accountId ? { id: value.accountId } : {}),
        },
      },
      select: {
        id: true,
        dueDate: true,
        account: { select: { id: true, name: true } },
        transactionInvoices: {
          where: { transaction: { status: { not: "FAILED" } } },
          select: {
            transaction: {
              select: {
                id: true,
                description: true,
                date: true,
                amount: true,
                installmentGroupId: true,
                installmentNumber: true,
                installmentCount: true,
                recurrenceId: true,
                splits: SPLITS_SELECT,
              },
            },
          },
        },
        payments: { select: { transaction: { select: { splits: SPLITS_SELECT } } } },
        creditsReceived: { select: { amount: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.person.findMany({
      where: { userId },
      select: { id: true, name: true, isSelf: true },
    }),
  ]);

  return computeCardPayoff({
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      dueDateKey: dateOnlyKey(invoice.dueDate),
      card: invoice.account,
      transactions: invoice.transactionInvoices.map(({ transaction }) => ({
        id: transaction.id,
        description: transaction.description,
        dateKey: dateOnlyKey(transaction.date),
        amountCents: toCents(transaction.amount.toNumber()),
        installmentGroupId: transaction.installmentGroupId,
        installmentNumber: transaction.installmentNumber,
        installmentCount: transaction.installmentCount,
        recurrenceId: transaction.recurrenceId,
        splits: transaction.splits.map((split) => ({
          personId: split.personId,
          amountCents: toCents(split.amount.toNumber()),
        })),
      })),
      paymentSplits: invoice.payments.flatMap((payment) =>
        payment.transaction.splits.map((split) => ({
          personId: split.personId,
          amountCents: toCents(split.amount.toNumber()),
        })),
      ),
      creditCents: invoice.creditsReceived.reduce(
        (sum, credit) => sum + toCents(credit.amount.toNumber()),
        0,
      ),
    })),
    people: people.map((person) => ({ ...person, name: formatPersonName(person.name) })),
    todayKey: todayCalendarDate(),
    scope: value.scope ?? DEFAULT_SCOPE,
    personIds: value.personIds,
    fromMonth: value.fromMonth,
  });
}
