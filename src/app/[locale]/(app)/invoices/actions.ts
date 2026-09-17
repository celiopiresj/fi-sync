"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { addDays } from "date-fns";
import { allocate, BRL, dinero, toDecimal } from "dinero.js";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { parseCalendarDate, todayCalendarDate, toAppZoned, fromAppZoned } from "@/lib/date";
import { resolveInvoiceForDate } from "@/lib/invoice-resolution";
import { recomputeInvoiceStatus, sumInvoiceTransactionsTotal } from "@/lib/invoice-total";
import { formatPersonName } from "@/lib/format-person-name";
import { invoicePeriodRange } from "./_lib/period";
import {
  payInvoiceSchema,
  refinePayInvoice,
  type PayInvoiceFormValues,
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

// Every invoice payment's settlement Transaction is filed under this
// category, so it reads apart from the individually-categorized
// purchases that made up the invoice (see prisma/schema.prisma's
// CategoryType.CARD_PAYMENT comment) — looked up by name/type rather
// than a fixed id since it's a plain seeded row, not something the
// schema pins. Falls back to no category if a user somehow deleted it;
// never blocks the payment over it. Same convention as loans/actions.ts'
// own findLoanCategory.
async function findInvoicePaymentCategory(userId: string) {
  return prisma.category.findFirst({
    where: {
      name: "Fatura de Cartão",
      type: "CARD_PAYMENT",
      OR: [{ userId: null }, { userId }],
    },
  });
}

// Derives the status shown to the user without ever writing "CLOSED" to
// the DB — see the doc comment on invoiceDisplayStatusValues in
// _schema/schema.ts. `PARTIALLY_PAID`/`PAID` always win once set (by
// recomputeInvoiceStatus, src/lib/invoice-total.ts); otherwise it's OPEN
// until the closing date has passed, then CLOSED.
function deriveDisplayStatus(
  invoice: { status: string; closingDate: Date },
  todayDate: Date,
): InvoiceDisplayStatus {
  if (invoice.status === "PARTIALLY_PAID") return "PARTIALLY_PAID";
  if (invoice.status === "PAID") return "PAID";
  return invoice.closingDate <= todayDate ? "CLOSED" : "OPEN";
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
    // isDefault (see its own comment in prisma/schema.prisma) rides
    // along on each account — PayInvoiceDialog looks it up itself
    // (`accounts.find((a) => a.isDefault)`) rather than a separately
    // threaded defaultAccountId.
    select: { id: true, name: true, isDefault: true },
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
// moment a credit-card transaction/occurrence is lit, or force-created by
// payInvoice below when an overpayment needs somewhere to park its
// credit. This screen is read-only except for payInvoice below.
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
            return { dueDate: { gte: range.from, lte: range.to } };
          })()
        : {}),
    },
    include: {
      account: { select: { id: true, name: true } },
      transactionInvoices: {
        include: { transaction: { select: { amount: true } } },
      },
      payments: { select: { amount: true } },
      creditsReceived: { select: { amount: true } },
    },
    orderBy: { dueDate: "desc" },
  });

  const mapped = invoices.map((invoice) => {
    const total = sumInvoiceTransactionsTotal(invoice.transactionInvoices);
    const creditApplied = invoice.creditsReceived.reduce(
      (sum, credit) => sum + credit.amount.toNumber(),
      0,
    );
    return {
      id: invoice.id,
      accountId: invoice.accountId,
      account: invoice.account,
      closingDate: invoice.closingDate,
      dueDate: invoice.dueDate,
      displayStatus: deriveDisplayStatus(invoice, todayDate),
      paidAmount: invoice.paidAmount?.toNumber() ?? null,
      paidAt: invoice.paidAt,
      total,
      creditApplied,
      remainingDue: Math.max(0, total - (invoice.paidAmount?.toNumber() ?? 0) - creditApplied),
      transactionCount: invoice.transactionInvoices.length,
    };
  });

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
          // Full transactions/actions.ts:listTransactions shape (account/
          // category/splits/transactionCard) — deliberately widened past
          // what this screen's own summary needs so `transactions` below
          // is a genuine TransactionRow[], reusable as-is by the same
          // DataTable/columns/search the /transactions screen uses (see
          // invoice-detail-view.tsx's own comment on that dependency).
          transaction: {
            include: {
              account: { select: { id: true, name: true, type: true } },
              category: { select: { id: true, name: true, icon: true, colorStyle: true } },
              splits: { include: { person: { select: { id: true, name: true } } } },
              transactionCard: {
                include: {
                  card: { select: { id: true, name: true, lastFourDigits: true } },
                },
              },
              // Structurally required for TransactionRow (see
              // listTransactions' own identical include) — unused here,
              // since `effectiveDate` below is derived directly from
              // this same invoice's own dueDate instead.
              transactionInvoice: {
                include: { invoice: { select: { dueDate: true } } },
              },
              // Also structurally required for TransactionRow (see
              // resolveSpecialTransactionKind, transactions/_lib) — a
              // row shown here is one of this invoice's own PURCHASES,
              // never the settlement transaction that pays the whole
              // invoice off, so these are always null in practice; kept
              // for the same type-compatibility reason as
              // transactionInvoice above, not because either is ever
              // expected to be set on a purchase row.
              loanInstallment: { select: { loanId: true } },
              invoicePayment: { select: { invoiceId: true } },
            },
          },
        },
        orderBy: { transaction: { date: "asc" } },
      },
      payments: {
        select: { id: true, amount: true, paidAt: true, transaction: { select: { accountId: true } } },
        orderBy: { paidAt: "desc" },
      },
      creditsReceived: { select: { amount: true } },
    },
  });
  if (!invoice) return null;

  // Adjacent invoices for the same card, one closing cycle away — the
  // prev/next navigation buttons on the detail header. closingDate (not
  // dueDate) is the ordering key since it's the field with the
  // `@@unique([accountId, closingDate])` constraint, so "immediately
  // before/after" is unambiguous. Invoices are created lazily per cycle
  // (see computeInvoiceCycle), so a neighboring cycle may simply not
  // exist yet — findFirst returning null is the normal "doesn't exist"
  // case, not an error, and the button is hidden for it.
  const [previousInvoice, nextInvoice] = await Promise.all([
    prisma.invoice.findFirst({
      where: { accountId: invoice.accountId, closingDate: { lt: invoice.closingDate } },
      orderBy: { closingDate: "desc" },
      select: { id: true },
    }),
    prisma.invoice.findFirst({
      where: { accountId: invoice.accountId, closingDate: { gt: invoice.closingDate } },
      orderBy: { closingDate: "asc" },
      select: { id: true },
    }),
  ]);

  const total = sumInvoiceTransactionsTotal(invoice.transactionInvoices);
  const creditApplied = invoice.creditsReceived.reduce(
    (sum, credit) => sum + credit.amount.toNumber(),
    0,
  );
  const paidAmount = invoice.paidAmount?.toNumber() ?? null;

  return {
    id: invoice.id,
    accountId: invoice.accountId,
    account: invoice.account,
    closingDate: invoice.closingDate,
    dueDate: invoice.dueDate,
    previousInvoiceId: previousInvoice?.id ?? null,
    nextInvoiceId: nextInvoice?.id ?? null,
    displayStatus: deriveDisplayStatus(invoice, todayDate),
    paidAmount,
    paidAt: invoice.paidAt,
    total,
    creditApplied,
    remainingDue: Math.max(0, total - (paidAmount ?? 0) - creditApplied),
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount.toNumber(),
      paidAt: payment.paidAt,
      accountId: payment.transaction.accountId,
    })),
    // Decimal→number, same conversion listTransactions itself does at
    // this same Server Action boundary — this IS that function's own
    // TransactionRow shape (see the include above), not a narrower
    // invoice-specific projection. `effectiveDate` mirrors
    // listTransactions' own field (a credit row's invoice due date) —
    // every transaction here already belongs to THIS invoice, so it's
    // just `invoice.dueDate` directly, no extra join needed.
    transactions: invoice.transactionInvoices.map((ti) => ({
      ...ti.transaction,
      amount: ti.transaction.amount.toNumber(),
      effectiveDate: invoice.dueDate,
      splits: ti.transaction.splits.map((split) => ({
        ...split,
        amount: split.amount.toNumber(),
      })),
    })),
  };
}

// Which people still have a balance owed on this invoice, and how much
// — feeds the manual allocation picker in pay-invoice-dialog.tsx (only
// shown once the user enters an amount that doesn't match remainingDue).
// Same "owed minus already settled" weighting payInvoice's own automatic
// path uses below, exposed here so the picker's people list and its
// initial per-person suggestion line up with what an automatic payment
// would have done.
export async function getInvoicePeopleOwed(id: string) {
  const userId = await requireUserId();

  const invoice = await prisma.invoice.findFirst({
    where: { id, account: { userId } },
    include: {
      transactionInvoices: {
        include: {
          transaction: {
            select: { amount: true, splits: { select: { personId: true, amount: true } } },
          },
        },
      },
      payments: {
        select: {
          transaction: { select: { splits: { select: { personId: true, amount: true } } } },
        },
      },
    },
  });
  if (!invoice) return [];

  const alreadyPaidByPerson = new Map<string, number>();
  for (const payment of invoice.payments) {
    for (const split of payment.transaction.splits) {
      const cents = Math.round(Math.abs(split.amount.toNumber()) * 100);
      alreadyPaidByPerson.set(split.personId, (alreadyPaidByPerson.get(split.personId) ?? 0) + cents);
    }
  }

  const owedTotalsCents = new Map<string, number>();
  let selfPersonId: string | null | undefined;

  for (const ti of invoice.transactionInvoices) {
    const splits = ti.transaction.splits;
    if (splits.length === 0) {
      if (selfPersonId === undefined) {
        const self = await prisma.person.findFirst({
          where: { userId, isSelf: true },
          select: { id: true },
        });
        selfPersonId = self?.id ?? null;
      }
      if (selfPersonId) {
        const cents = Math.round(Math.abs(ti.transaction.amount.toNumber()) * 100);
        owedTotalsCents.set(selfPersonId, (owedTotalsCents.get(selfPersonId) ?? 0) + cents);
      }
      continue;
    }
    for (const split of splits) {
      const cents = Math.round(Math.abs(split.amount.toNumber()) * 100);
      owedTotalsCents.set(split.personId, (owedTotalsCents.get(split.personId) ?? 0) + cents);
    }
  }

  const personIds = [...owedTotalsCents.keys()];
  if (personIds.length === 0) return [];

  const people = await prisma.person.findMany({
    where: { id: { in: personIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(people.map((person) => [person.id, person.name]));

  return personIds
    .map((personId) => ({
      personId,
      personName: formatPersonName(nameById.get(personId) ?? ""),
      remainingCents: owedTotalsCents.get(personId)! - (alreadyPaidByPerson.get(personId) ?? 0),
    }))
    .filter((person) => person.remainingCents > 0);
}

// A single hop's worth of overflow credit — how much of it this
// specific downstream invoice can absorb right now. An invoice with no
// real transactions linked yet (a bare future cycle, likely just
// force-created by resolveInvoiceForDate below) has no known total to
// compare against, so it simply absorbs everything remaining and the
// loop stops there — same reasoning as projections/actions.ts treating
// an as-yet-empty month as having nothing to project. An invoice that
// DOES already carry real purchases only absorbs up to its own
// remaining due, letting genuine leftover keep rolling to the invoice
// after it.
async function applyOverflowCredit(
  tx: Parameters<typeof recomputeInvoiceStatus>[0],
  accountId: string,
  sourcePaymentId: string,
  fromClosingDate: Date,
  cardDetails: { closingDay: number; dueDay: number },
  overflowCents: number,
) {
  let remainingCents = overflowCents;
  let cursorDate = fromClosingDate;
  // A card cycle is effectively always monthly — this many hops covers
  // years of rolling overpayment, far past anything a real user would
  // hit, and exists only as a guard against an unbounded loop.
  const MAX_HOPS = 24;

  for (let hop = 0; hop < MAX_HOPS && remainingCents > 0; hop++) {
    cursorDate = fromAppZoned(addDays(toAppZoned(cursorDate), 1));
    const nextInvoice = await resolveInvoiceForDate(accountId, cursorDate, cardDetails, tx);

    const nextData = await tx.invoice.findUniqueOrThrow({
      where: { id: nextInvoice.id },
      include: {
        transactionInvoices: { include: { transaction: { select: { amount: true } } } },
        payments: { select: { amount: true } },
        creditsReceived: { select: { amount: true } },
      },
    });
    const hasKnownTotal = nextData.transactionInvoices.length > 0;
    const nextTotalCents = Math.round(sumInvoiceTransactionsTotal(nextData.transactionInvoices) * 100);
    const nextPaidCents = Math.round(
      nextData.payments.reduce((sum, payment) => sum + payment.amount.toNumber(), 0) * 100,
    );
    const nextCreditCents = Math.round(
      nextData.creditsReceived.reduce((sum, credit) => sum + credit.amount.toNumber(), 0) * 100,
    );
    const nextRemainingCents = Math.max(0, nextTotalCents - nextPaidCents - nextCreditCents);

    const creditForThisHop = hasKnownTotal ? Math.min(remainingCents, nextRemainingCents) : remainingCents;

    if (creditForThisHop > 0) {
      await tx.invoiceCredit.create({
        data: {
          sourcePaymentId,
          targetInvoiceId: nextInvoice.id,
          amount: creditForThisHop / 100,
        },
      });
      await recomputeInvoiceStatus(tx, nextInvoice.id);
      remainingCents -= creditForThisHop;
    }

    cursorDate = nextInvoice.closingDate;
    // Landed on a cycle with no purchases yet — its eventual total is
    // unknowable right now, so there's nothing meaningful to compare a
    // remainder against; park everything here and stop instead of
    // guessing forward past it.
    if (!hasKnownTotal) break;
  }
}

// Registers a payment against an invoice — may fully or only partially
// cover what's due (see PARTIALLY_PAID in the InvoiceStatus enum), and
// may repeat over time until the invoice is fully settled. Renamed from
// the old markInvoicePaid: a call here no longer always "marks paid".
export async function payInvoice(id: string, data: PayInvoiceFormValues) {
  const userId = await requireUserId();

  const existing = await prisma.invoice.findFirst({
    where: { id, account: { userId } },
    include: {
      account: {
        select: { id: true, name: true, creditCardDetails: { select: { closingDay: true, dueDay: true } } },
      },
      transactionInvoices: {
        include: {
          transaction: {
            select: {
              amount: true,
              splits: { select: { personId: true, amount: true } },
            },
          },
        },
      },
      payments: {
        select: {
          amount: true,
          transaction: { select: { splits: { select: { personId: true, amount: true } } } },
        },
      },
      creditsReceived: { select: { amount: true } },
    },
  });
  if (!existing) {
    return { error: "Not found" };
  }

  const total = sumInvoiceTransactionsTotal(existing.transactionInvoices);
  const paidSoFar = existing.payments.reduce((sum, payment) => sum + payment.amount.toNumber(), 0);
  const creditReceived = existing.creditsReceived.reduce(
    (sum, credit) => sum + credit.amount.toNumber(),
    0,
  );
  const remainingDueCents = Math.max(0, Math.round((total - paidSoFar - creditReceived) * 100));

  const t = await getTranslations("scrn-invoices");
  const tValidation = await getTranslations("common.validation");

  const schema = payInvoiceSchema.superRefine((value, ctx) =>
    refinePayInvoice(value, ctx, {
      remainingDueCents,
      messages: {
        allocationsRequired: tValidation("required"),
        allocationsMismatch: t("detail.markPaid.allocations.mismatch"),
      },
    }),
  );
  const result = schema.safeParse(data);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid data" };
  }
  const value = result.data;

  const payAccount = await prisma.account.findFirst({
    where: { id: value.accountId, userId, type: { in: ["CHECKING", "SAVINGS", "CASH"] } },
  });
  if (!payAccount) {
    return { error: "Not found" };
  }

  const paidAt = parseCalendarDate(value.paidAt);
  const paidCents = Math.round(value.paidAmount * 100);
  const appliedCents = Math.min(paidCents, remainingDueCents);
  const overflowCents = Math.max(0, paidCents - remainingDueCents);
  const invoicePaymentCategory = await findInvoicePaymentCategory(userId);

  let splitsCreateInput: { personId: string; amount: number }[];

  if (value.allocations.length > 0) {
    // Manual allocation — the user picked exactly who this payment
    // covers and how much (refinePayInvoice already verified it sums to
    // appliedCents).
    splitsCreateInput = value.allocations.map((allocation) => ({
      personId: allocation.personId,
      amount: -allocation.amount,
    }));
  } else {
    // Auto path — only reachable when paidCents === remainingDueCents
    // (refinePayInvoice's own gate), so appliedCents === paidCents here.
    // Mirror each purchase's own person split, scaled to what's still
    // owed — same rule the app always used, extended to subtract
    // whatever a PRIOR partial payment already settled for that person,
    // so a second automatic payment can't double-count someone who was
    // already paid off. A purchase with no splits of its own counts
    // toward whichever Person is marked isSelf — every user has exactly
    // one, created at sign-up (see sync-user.ts).
    const alreadyPaidByPerson = new Map<string, number>();
    for (const payment of existing.payments) {
      for (const split of payment.transaction.splits) {
        const cents = Math.round(Math.abs(split.amount.toNumber()) * 100);
        alreadyPaidByPerson.set(
          split.personId,
          (alreadyPaidByPerson.get(split.personId) ?? 0) + cents,
        );
      }
    }

    // SIGNED cents here (an expense is negative, a refund/reversal
    // positive), flipped into a magnitude only at the very end. Summing
    // `Math.abs(split)` per row instead made a refund ADD to what its
    // person owes rather than subtract it — the exact 2x overstatement
    // sumInvoiceTransactionsTotal already documents for the invoice's
    // own total (src/lib/invoice-total.ts), reproduced one layer down in
    // the per-person split of it. Since the invoice total DOES net the
    // refund out, the inflated ratios no longer summed to the amount
    // being allocated, and `allocate` silently scaled every person's
    // share down to fit.
    const owedTotalsCents = new Map<string, number>();
    let selfPersonId: string | null | undefined;

    function addOwed(personId: string, cents: number) {
      owedTotalsCents.set(personId, (owedTotalsCents.get(personId) ?? 0) + cents);
    }

    async function resolveSelfPersonId() {
      if (selfPersonId === undefined) {
        const self = await prisma.person.findFirst({
          where: { userId, isSelf: true },
          select: { id: true },
        });
        selfPersonId = self?.id ?? null;
      }
      return selfPersonId;
    }

    for (const ti of existing.transactionInvoices) {
      const amountCents = Math.round(ti.transaction.amount.toNumber() * 100);
      let attributedCents = 0;
      for (const split of ti.transaction.splits) {
        const cents = Math.round(split.amount.toNumber() * 100);
        addOwed(split.personId, cents);
        attributedCents += cents;
      }

      // Whatever the splits don't cover is the user's own share — the
      // same rule the app applies to a transaction with NO splits at all
      // (see Transaction.splits in prisma/schema.prisma), just extended
      // to a PARTIALLY split one, which the previous version ignored
      // entirely: a R$53,11 purchase with only R$13,28 attributed left
      // R$39,83 out of the ratio total, so everyone else's share of the
      // payment got scaled to cover it.
      const uncoveredCents = amountCents - attributedCents;
      if (uncoveredCents !== 0) {
        const self = await resolveSelfPersonId();
        if (self) addOwed(self, uncoveredCents);
      }
    }

    const remainingByPersonCents = new Map<string, number>();
    for (const [personId, owedCents] of owedTotalsCents) {
      // Negated: a real debt accumulated above as a negative (expense
      // sign), while `allocate` needs a positive ratio. Someone whose
      // refunds outweigh their purchases nets out non-positive here and
      // drops out of the allocation entirely, same as before.
      const remaining = -owedCents - (alreadyPaidByPerson.get(personId) ?? 0);
      if (remaining > 0) remainingByPersonCents.set(personId, remaining);
    }

    const personIds = [...remainingByPersonCents.keys()];
    splitsCreateInput =
      personIds.length > 0
        ? allocate(
            dinero({ amount: appliedCents, currency: BRL }),
            personIds.map((personId) => remainingByPersonCents.get(personId)!),
          ).map((share, index) => ({
            personId: personIds[index]!,
            amount: -Number(toDecimal(share)),
          }))
        : [];
  }

  // Paying a card invoice is, in effect, an expense on the account the
  // money actually left from — same spirit as a transfer's two linked
  // rows (see prisma/schema.prisma's top comment), except here only the
  // "outgoing" leg exists (the credit-card account itself has no running
  // balance to credit; Invoice.status/paidAmount already represents that
  // side). Interactive transaction (not a plain array): the InvoicePayment
  // row needs the just-created settlement Transaction's id, and any
  // overflow credit needs the just-created InvoicePayment's id.
  await prisma.$transaction(async (tx) => {
    const paymentTransaction = await tx.transaction.create({
      data: {
        userId,
        accountId: payAccount.id,
        description: t("detail.markPaid.transactionDescription", {
          card: existing.account.name,
        }),
        amount: -(appliedCents / 100),
        date: paidAt,
        categoryId: invoicePaymentCategory?.id,
        splits: { create: splitsCreateInput },
      },
    });

    const invoicePayment = await tx.invoicePayment.create({
      data: {
        invoiceId: id,
        transactionId: paymentTransaction.id,
        amount: appliedCents / 100,
        paidAt,
      },
    });

    await recomputeInvoiceStatus(tx, id);

    if (overflowCents > 0 && existing.account.creditCardDetails) {
      await applyOverflowCredit(
        tx,
        existing.accountId,
        invoicePayment.id,
        existing.closingDate,
        existing.account.creditCardDetails,
        overflowCents,
      );
    }
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/cards");
  revalidatePath("/accounts");
  revalidatePath("/people");
  revalidatePath("/projections");
  return { error: null };
}

// Corrects WHEN a payment happened (e.g. it was actually paid a day
// earlier/later than what got typed at the time) without touching
// anything about how much, by whom, or what it settled — those all stay
// exactly as payInvoice originally computed them. Kept in lockstep with
// the settlement Transaction's own `date` (payInvoice sets both to the
// same value at creation, see its own comment) so the two can't drift
// apart — this is the one legitimate way to edit either after the fact,
// since the plain transaction edit form refuses this row entirely (see
// transactions/_lib/special-transaction.ts).
export async function updateInvoicePaymentDate(paymentId: string, paidAtStr: string) {
  const userId = await requireUserId();

  if (!paidAtStr) return { error: "Invalid data" };

  const payment = await prisma.invoicePayment.findFirst({
    where: { id: paymentId, invoice: { account: { userId } } },
    select: { id: true, invoiceId: true, transactionId: true },
  });
  if (!payment) return { error: "Not found" };

  const paidAt = parseCalendarDate(paidAtStr);

  await prisma.$transaction(async (tx) => {
    await tx.invoicePayment.update({
      where: { id: payment.id },
      data: { paidAt },
    });
    await tx.transaction.update({
      where: { id: payment.transactionId },
      data: { date: paidAt },
    });
    // Invoice.paidAt is the latest of its payments' own dates — moving
    // this one (the only payment, in the common case) can change that.
    await recomputeInvoiceStatus(tx, payment.invoiceId);
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${payment.invoiceId}`);
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/projections");
  return { error: null };
}
