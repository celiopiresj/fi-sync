import { addDays } from "date-fns";
import { fromAppZoned, toAppZoned } from "@/lib/date";
import { resolveInvoiceForDate } from "@/lib/invoice-resolution";
import { recomputeInvoiceStatus, sumInvoiceTransactionsTotal } from "@/lib/invoice-total";

// Forwards an overpayment from one invoice to downstream cycle(s).
// Iterates up to MAX_HOPS months forward, allocating credit up to each
// invoice's remaining due, or parking the remainder on the first cycle with
// no purchases yet.
export async function applyOverflowCredit(
  tx: Parameters<typeof recomputeInvoiceStatus>[0],
  accountId: string,
  sourcePaymentId: string,
  fromClosingDate: Date,
  cardDetails: { closingDay: number; dueDay: number },
  overflowCents: number,
) {
  let remainingCents = overflowCents;
  let cursorDate = fromClosingDate;
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
    if (!hasKnownTotal) break;
  }
}

// When a transaction is deleted or unlinked from an invoice that already has
// payments or credits received, the invoice's total purchases decrease.
// If the total payments and credits received now exceed the updated total
// (plus any credits already given), the newly created surplus rolls forward
// to downstream invoice(s) as an InvoiceCredit.
export async function forwardInvoiceSurplusCredit(
  tx: Parameters<typeof recomputeInvoiceStatus>[0],
  invoiceId: string,
) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      account: {
        include: { creditCardDetails: { select: { closingDay: true, dueDay: true } } },
      },
      transactionInvoices: { include: { transaction: { select: { amount: true } } } },
      payments: {
        include: { creditsGiven: { select: { amount: true } } },
        orderBy: { paidAt: "asc" },
      },
      creditsReceived: { select: { amount: true, sourcePaymentId: true } },
    },
  });

  if (!invoice) return;

  const total = sumInvoiceTransactionsTotal(invoice.transactionInvoices);
  const paidAmount = invoice.payments.reduce(
    (sum, payment) => sum + payment.amount.toNumber(),
    0,
  );
  const creditReceived = invoice.creditsReceived.reduce(
    (sum, credit) => sum + credit.amount.toNumber(),
    0,
  );
  const existingCreditsGiven = invoice.payments
    .flatMap((p) => p.creditsGiven)
    .reduce((sum, c) => sum + c.amount.toNumber(), 0);

  const surplus = Math.max(0, paidAmount + creditReceived - total - existingCreditsGiven);
  const overflowCents = Math.round(surplus * 100);

  if (overflowCents > 0) {
    const sourcePaymentId =
      invoice.payments[invoice.payments.length - 1]?.id ??
      invoice.creditsReceived[0]?.sourcePaymentId;

    const cardDetails = invoice.account.creditCardDetails;
    if (sourcePaymentId && cardDetails) {
      await applyOverflowCredit(
        tx,
        invoice.accountId,
        sourcePaymentId,
        invoice.closingDate,
        cardDetails,
        overflowCents,
      );
    }
  }

  await recomputeInvoiceStatus(tx, invoiceId);
}

