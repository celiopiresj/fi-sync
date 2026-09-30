import { prisma } from "@/lib/prisma";
import { dateOnlyKey, parseCalendarDate } from "@/lib/date";
import { resolveInvoiceForDate } from "@/lib/invoice-resolution";
import { recomputeInvoiceStatus } from "@/lib/invoice-total";

// Re-points each transaction's TransactionInvoice at the invoice its
// CURRENT account + date actually belong to. Needed after any edit that
// changes a transaction's `accountId` or `date` in place: the link is
// only ever written at creation time, so without this a purchase moved
// from one card to another kept counting toward the OLD card's invoice
// (verified: "Amazon Prime" moved C6 → Next stayed inside every C6
// invoice, so /transactions — filtered by account — and /invoices —
// summed by link — disagreed by exactly that amount).
//
// Callers must pass only rows whose account or date really changed:
// installment rows are linked by their generation loop's own cycle
// cursor, not re-derived from `date`, so blindly relinking an untouched
// installment could move it.
//
// A row now on a non-card account just loses its link. Every invoice
// that lost or gained a row gets its cached status/paidAmount
// recomputed. Sequential, one row at a time — resolveInvoiceForDate
// isn't safe under concurrent calls for the same account.
export async function relinkTransactionInvoices(transactionIds: string[]) {
  if (transactionIds.length === 0) return;

  const affectedInvoiceIds = new Set<string>();

  for (const transactionId of transactionIds) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        date: true,
        accountId: true,
        account: { select: { type: true, creditCardDetails: true } },
        transactionInvoice: { select: { invoiceId: true } },
      },
    });
    if (!transaction) continue;

    const currentInvoiceId = transaction.transactionInvoice?.invoiceId;
    const details = transaction.account.creditCardDetails;

    if (transaction.account.type !== "CREDIT_CARD" || !details) {
      if (currentInvoiceId) {
        await prisma.transactionInvoice.delete({ where: { transactionId } });
        affectedInvoiceIds.add(currentInvoiceId);
      }
      continue;
    }

    // `date` comes back from its `@db.Date` column as UTC midnight —
    // re-pinned to APP_TIME_ZONE before the cycle math, or the closing
    // day drifts by a day (see src/lib/date.ts).
    const target = await resolveInvoiceForDate(
      transaction.accountId,
      parseCalendarDate(dateOnlyKey(transaction.date)),
      details,
    );
    if (target.id === currentInvoiceId) continue;

    await prisma.transactionInvoice.upsert({
      where: { transactionId },
      update: { invoiceId: target.id },
      create: { transactionId, invoiceId: target.id },
    });
    affectedInvoiceIds.add(target.id);
    if (currentInvoiceId) affectedInvoiceIds.add(currentInvoiceId);
  }

  // One interactive transaction per invoice, not one for all of them — a
  // recurrence moved to another card can touch a couple dozen invoices,
  // which blew past Prisma's 5s interactive-transaction timeout when
  // they all shared one.
  for (const invoiceId of affectedInvoiceIds) {
    await prisma.$transaction(async (tx) => {
      await recomputeInvoiceStatus(tx, invoiceId);
    });
  }
}
