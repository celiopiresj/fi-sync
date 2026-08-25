"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { daysUntilDue } from "./_lib/next-due-date";
import {
  creditCardAccountSchema,
  refineCreditCardAccount,
  type CreditCardAccountFormValues,
} from "./_schema/schema";

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

async function validateCreditCardAccount(data: CreditCardAccountFormValues) {
  const tValidation = await getTranslations("common.validation");
  const schema = creditCardAccountSchema.superRefine((value, ctx) =>
    refineCreditCardAccount(value, ctx, {
      lastFourDigitsInvalid: tValidation("invalid"),
    }),
  );
  return schema.safeParse(data);
}

// Every CREDIT_CARD account for the user, including inactive ones (this
// screen is where you'd reactivate one — the "hide inactive" rule only
// applies to transaction-form.tsx/recurrence-form.tsx's own account
// pickers). `availableLimit` is computed here rather than stored: limit
// minus the total of every invoice that hasn't been marked PAID yet
// (tasks/013.md's User Review Required answer — a paid invoice no
// longer consumes limit, an open or past-due one still does). `status`
// on `CreditCardDetails.status`? No such field — CLOSED is never
// written to Invoice.status (see listInvoices in the invoices route for
// the same "derive from date, don't persist CLOSED" rule), so filtering
// `status: { not: "PAID" }` here already covers every invoice that still
// counts against the limit.
export async function listCreditCardAccounts() {
  const userId = await requireUserId();

  const accounts = await prisma.account.findMany({
    where: { userId, type: "CREDIT_CARD" },
    include: {
      creditCardDetails: true,
      cards: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { transactionCards: true } } },
      },
      invoices: {
        where: { status: { not: "PAID" } },
        include: {
          transactionInvoices: {
            include: { transaction: { select: { amount: true } } },
          },
        },
      },
      _count: { select: { transactions: true } },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();

  return accounts.map((account) => {
    const outstanding = account.invoices.reduce((sum, invoice) => {
      const invoiceTotal = invoice.transactionInvoices.reduce(
        (total, ti) => total + Math.abs(ti.transaction.amount.toNumber()),
        0,
      );
      return sum + invoiceTotal;
    }, 0);
    const limit = account.creditCardDetails?.limit.toNumber() ?? 0;
    const dueDay = account.creditCardDetails?.dueDay ?? null;

    return {
      id: account.id,
      name: account.name,
      status: account.status,
      limit,
      availableLimit: limit - outstanding,
      // `spent` is literally the outstanding total — availableLimit is
      // already `limit - outstanding`, so `limit - availableLimit`
      // reduces back to `outstanding`. Kept as its own field (rather
      // than recomputed by every caller) since the "Atenção
      // necessária"/"Todos os cartões" sections both need it alongside
      // usagePercent for the same row.
      spent: outstanding,
      usagePercent: limit > 0 ? Math.round((outstanding / limit) * 100) : 0,
      closingDay: account.creditCardDetails?.closingDay ?? null,
      dueDay,
      daysUntilDue: dueDay !== null ? daysUntilDue(dueDay, now) : null,
      hasTransactions: account._count.transactions > 0,
      cards: account.cards.map((card) => ({
        id: card.id,
        name: card.name,
        lastFourDigits: card.lastFourDigits,
        status: card.status,
        colorStyle: card.colorStyle,
        hasTransactions: card._count.transactionCards > 0,
      })),
    };
  });
}

// Creates the Account + its 1:1 CreditCardDetails + every Card row in
// one nested `create` call — already atomic (a single INSERT statement
// tree under one implicit transaction), no explicit `$transaction`
// needed for this direction (unlike updateCreditCardAccount below, which
// touches several existing rows across calls and does need one).
export async function createCreditCardAccount(data: CreditCardAccountFormValues) {
  const userId = await requireUserId();
  const result = await validateCreditCardAccount(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;

  await prisma.account.create({
    data: {
      userId,
      name: value.name,
      type: "CREDIT_CARD",
      creditCardDetails: {
        create: {
          limit: value.limit,
          closingDay: value.closingDay,
          dueDay: value.dueDay,
        },
      },
      cards: {
        create: value.cards.map((card) => ({
          name: card.name,
          lastFourDigits: card.lastFourDigits || null,
          colorStyle: card.colorStyle || null,
        })),
      },
    },
  });

  revalidatePath("/cards");
  return { error: null };
}

// Reconciles the submitted `cards` array against what's already in the
// DB by `id` — deliberately NOT a delete-then-recreate of the whole
// array (unlike RecurrenceSplit/TransactionSplit elsewhere in the app):
// Card.id is referenced directly by TransactionCard (`onDelete:
// Cascade`), so deleting and recreating every row on every edit would
// silently wipe out "which physical card was used" on every historical
// transaction, even ones untouched by this edit. Existing cards are
// updated in place; a row missing from the submission is only deleted if
// it has zero TransactionCard rows — otherwise the whole update is
// rejected (tasks/013.md: removing a card with transaction history isn't
// allowed, only disabling it via toggleCardStatus below).
export async function updateCreditCardAccount(
  id: string,
  data: CreditCardAccountFormValues,
) {
  const userId = await requireUserId();
  const t = await getTranslations("scrn-cards");
  const result = await validateCreditCardAccount(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;

  const existing = await prisma.account.findUnique({
    where: { id, userId },
    include: {
      cards: { include: { _count: { select: { transactionCards: true } } } },
    },
  });
  if (!existing) {
    return { error: "Not found" };
  }

  const submittedIds = new Set(
    value.cards.filter((card) => card.id).map((card) => card.id),
  );
  const removedCards = existing.cards.filter((card) => !submittedIds.has(card.id));
  const blockedRemovals = removedCards.filter(
    (card) => card._count.transactionCards > 0,
  );
  if (blockedRemovals.length > 0) {
    return { error: t("errors.cardHasTransactions") };
  }

  const cardsToUpdate = value.cards.filter((card) => card.id);
  const cardsToCreate = value.cards.filter((card) => !card.id);

  await prisma.$transaction([
    prisma.account.update({ where: { id }, data: { name: value.name } }),
    prisma.creditCardDetails.update({
      where: { accountId: id },
      data: {
        limit: value.limit,
        closingDay: value.closingDay,
        dueDay: value.dueDay,
      },
    }),
    ...removedCards.map((card) => prisma.card.delete({ where: { id: card.id } })),
    ...cardsToUpdate.map((card) =>
      prisma.card.update({
        where: { id: card.id },
        data: { name: card.name, lastFourDigits: card.lastFourDigits || null, colorStyle: card.colorStyle || null },
      }),
    ),
    ...cardsToCreate.map((card) =>
      prisma.card.create({
        data: {
          accountId: id,
          name: card.name,
          lastFourDigits: card.lastFourDigits || null,
          colorStyle: card.colorStyle || null,
        },
      }),
    ),
  ]);

  revalidatePath("/cards");
  revalidatePath("/transactions");
  revalidatePath("/recurrences");
  return { error: null };
}

// Hard delete — blocked when the account has any Transaction linked
// (tasks/013.md's decision: unlike the plain-accounts screen, a credit
// card account can only be archived once it has history, never deleted
// out from under its own transactions/invoices). Archiving
// (toggleCreditCardAccountStatus below) is the always-available
// alternative.
export async function deleteCreditCardAccount(id: string) {
  const userId = await requireUserId();
  const t = await getTranslations("scrn-cards");

  const existing = await prisma.account.findUnique({
    where: { id, userId },
    include: { _count: { select: { transactions: true } } },
  });
  if (!existing) {
    return { error: "Not found" };
  }
  if (existing._count.transactions > 0) {
    return { error: t("errors.accountHasTransactions") };
  }

  await prisma.account.delete({ where: { id } });

  revalidatePath("/cards");
  return { error: null };
}

export async function toggleCreditCardAccountStatus(id: string) {
  const userId = await requireUserId();

  const existing = await prisma.account.findUnique({ where: { id, userId } });
  if (!existing) {
    return { error: "Not found" };
  }

  await prisma.account.update({
    where: { id },
    data: { status: existing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
  });

  revalidatePath("/cards");
  revalidatePath("/transactions");
  revalidatePath("/recurrences");
  return { error: null };
}

// Disables/re-enables one physical card without touching its history —
// the alternative to removing a card row that already has transactions
// (see updateCreditCardAccount's doc comment above). An inactive card
// drops out of transaction-form.tsx/recurrence-form.tsx's card picker
// for NEW selections but stays visible on whatever transaction already
// used it.
export async function toggleCardStatus(cardId: string) {
  const userId = await requireUserId();

  const card = await prisma.card.findFirst({
    where: { id: cardId, account: { userId } },
  });
  if (!card) {
    return { error: "Not found" };
  }

  await prisma.card.update({
    where: { id: cardId },
    data: { status: card.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
  });

  revalidatePath("/cards");
  revalidatePath("/transactions");
  revalidatePath("/recurrences");
  return { error: null };
}
