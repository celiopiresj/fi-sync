"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { parseCalendarDate, todayCalendarDate } from "@/lib/date";
import { invoicePeriodRange } from "./_lib/period";
import {
  markInvoicePaidSchema,
  type MarkInvoicePaidFormValues,
  type InvoiceDisplayStatus,
} from "./_schema/schema";
import type { InvoicePeriod } from "./_types/types";

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// Derives the status shown to the user without ever writing "CLOSED" to
// the DB — see the doc comment on invoiceDisplayStatusValues in
// _schema/schema.ts. `PAID` always wins once set explicitly
// (markInvoicePaid below); otherwise it's OPEN until the closing date has
// passed, then CLOSED.
function deriveDisplayStatus(
  invoice: { status: string; closingDate: Date },
  todayDate: Date,
): InvoiceDisplayStatus {
  if (invoice.status === "PAID") return "PAID";
  return invoice.closingDate <= todayDate ? "CLOSED" : "OPEN";
}

function sumInvoiceTotal(
  transactionInvoices: { transaction: { amount: { toNumber(): number } } }[],
): number {
  return transactionInvoices.reduce(
    (sum, ti) => sum + Math.abs(ti.transaction.amount.toNumber()),
    0,
  );
}

// Light-weight options for the account filter dropdown — deliberately
// not importing cards/actions.ts's own listCreditCardAccounts (per-route
// self-containment, same convention recurrences/actions.ts follows
// rather than importing from transactions/actions.ts) since this screen
// only needs id+name, not limit/cards/availableLimit.
export async function getInvoiceFormOptions() {
  const userId = await requireUserId();

  const accounts = await prisma.account.findMany({
    where: { userId, type: "CREDIT_CARD" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return { accounts };
}

// Which accounts an invoice payment can come out of — the manageable
// debit-capable ones (see accounts/_schema/schema.ts's own
// accountTypeValues; CREDIT_CARD/INVESTMENT/POCKET are excluded, the
// latter two having no management screen yet either).
export async function getPayableAccounts() {
  const userId = await requireUserId();

  return prisma.account.findMany({
    where: { userId, type: { in: ["CHECKING", "SAVINGS", "CASH"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export type InvoiceFilters = {
  accountId?: string;
  status?: InvoiceDisplayStatus | "all";
  period?: InvoicePeriod;
};

// No Invoice is ever created here — every row already exists, generated
// lazily by resolveInvoiceForDate (src/lib/invoice-resolution.ts) the
// moment a credit-card transaction/occurrence is lit. This screen is
// read-only except for markInvoicePaid below.
export async function listInvoices(filters: InvoiceFilters = {}) {
  const userId = await requireUserId();
  const todayDate = parseCalendarDate(todayCalendarDate());

  const invoices = await prisma.invoice.findMany({
    where: {
      account: { userId, type: "CREDIT_CARD" },
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.period
        ? (() => {
            const range = invoicePeriodRange(filters.period);
            return { closingDate: { gte: range.from, lte: range.to } };
          })()
        : {}),
    },
    include: {
      account: { select: { id: true, name: true } },
      transactionInvoices: {
        include: { transaction: { select: { amount: true } } },
      },
    },
    orderBy: { closingDate: "desc" },
  });

  const mapped = invoices.map((invoice) => ({
    id: invoice.id,
    accountId: invoice.accountId,
    account: invoice.account,
    closingDate: invoice.closingDate,
    dueDate: invoice.dueDate,
    displayStatus: deriveDisplayStatus(invoice, todayDate),
    paidAmount: invoice.paidAmount?.toNumber() ?? null,
    paidAt: invoice.paidAt,
    total: sumInvoiceTotal(invoice.transactionInvoices),
    transactionCount: invoice.transactionInvoices.length,
  }));

  if (!filters.status || filters.status === "all") return mapped;
  return mapped.filter((invoice) => invoice.displayStatus === filters.status);
}

export async function getInvoiceDetail(id: string) {
  const userId = await requireUserId();
  const todayDate = parseCalendarDate(todayCalendarDate());

  const invoice = await prisma.invoice.findFirst({
    where: { id, account: { userId, type: "CREDIT_CARD" } },
    include: {
      account: { select: { id: true, name: true } },
      transactionInvoices: {
        include: {
          transaction: {
            include: {
              category: { select: { id: true, name: true, icon: true } },
              transactionCard: {
                include: {
                  card: { select: { id: true, name: true, lastFourDigits: true } },
                },
              },
            },
          },
        },
        orderBy: { transaction: { date: "asc" } },
      },
    },
  });
  if (!invoice) return null;

  return {
    id: invoice.id,
    accountId: invoice.accountId,
    account: invoice.account,
    closingDate: invoice.closingDate,
    dueDate: invoice.dueDate,
    displayStatus: deriveDisplayStatus(invoice, todayDate),
    paidAmount: invoice.paidAmount?.toNumber() ?? null,
    paidAt: invoice.paidAt,
    total: sumInvoiceTotal(invoice.transactionInvoices),
    transactions: invoice.transactionInvoices.map((ti) => ({
      id: ti.transaction.id,
      description: ti.transaction.description,
      amount: ti.transaction.amount.toNumber(),
      date: ti.transaction.date,
      category: ti.transaction.category,
      card: ti.transaction.transactionCard?.card ?? null,
    })),
  };
}

export async function markInvoicePaid(id: string, data: MarkInvoicePaidFormValues) {
  const userId = await requireUserId();
  const result = markInvoicePaidSchema.safeParse(data);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }

  const value = result.data;
  const t = await getTranslations("scrn-invoices");

  const existing = await prisma.invoice.findFirst({
    where: { id, account: { userId } },
    include: { account: { select: { name: true } } },
  });
  if (!existing) {
    return { error: "Not found" };
  }

  const payAccount = await prisma.account.findFirst({
    where: { id: value.accountId, userId, type: { in: ["CHECKING", "SAVINGS", "CASH"] } },
  });
  if (!payAccount) {
    return { error: "Not found" };
  }

  const paidAt = parseCalendarDate(value.paidAt);

  // Paying a card invoice is, in effect, an expense on the account the
  // money actually left from — same spirit as a transfer's two linked
  // rows (see prisma/schema.prisma's top comment), except here only the
  // "outgoing" leg exists (the credit-card account itself has no running
  // balance to credit; Invoice.status/paidAmount already represents that
  // side). Both writes happen in one transaction so a paid invoice can
  // never exist without its matching expense, or vice versa.
  await prisma.$transaction([
    prisma.invoice.update({
      where: { id },
      data: { status: "PAID", paidAmount: value.paidAmount, paidAt },
    }),
    prisma.transaction.create({
      data: {
        userId,
        accountId: payAccount.id,
        description: t("markPaid.transactionDescription", {
          card: existing.account.name,
        }),
        amount: -value.paidAmount,
        date: paidAt,
      },
    }),
  ]);

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/cards");
  revalidatePath("/accounts");
  return { error: null };
}
