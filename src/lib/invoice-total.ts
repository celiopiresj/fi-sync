import type { Prisma } from "@/generated/prisma/client";

// Replaces the sum-every-linked-transaction reduce that used to be
// duplicated in invoices/actions.ts (listInvoices, getInvoiceDetail) and
// cards/actions.ts (listCreditCardAccounts) — an Invoice has no stored
// total, it's always derived from its TransactionInvoice join rows.
//
// Nets the SIGNED amounts first, then takes the magnitude of that net —
// not the sum of each row's own magnitude. Those two only agree when
// every linked transaction has the same sign; a refund/reversal
// (positive) mixed in with the invoice's expenses (negative) is supposed
// to REDUCE the total, but summing per-row absolute values adds its
// magnitude instead, overstating the invoice by 2x that refund. Verified
// against a real invoice: two refunds totaling R$50.46 inflated the
// displayed total by R$100.92 (2x) versus the real bank statement.
export function sumInvoiceTransactionsTotal(
  transactionInvoices: { transaction: { amount: { toNumber(): number } } }[],
): number {
  const netAmount = transactionInvoices.reduce(
    (sum, ti) => sum + ti.transaction.amount.toNumber(),
    0,
  );
  return Math.abs(netAmount);
}

// Single source of truth for deriving an Invoice's cached
// status/paidAmount/paidAt from its live InvoicePayment rows (real money
// paid against it) and inbound InvoiceCredit rows (credit received from
// an earlier invoice's overpayment) vs. its transaction-derived total.
// Called after ANY mutation that can change those: payInvoice
// (invoices/actions.ts, for both the invoice being paid and — on
// overflow — every invoice a credit gets forwarded to), and
// revertPaidInvoicesFor (transactions/actions.ts, when a settlement
// Transaction is deleted).
//
// Deliberately never looks at the settlement transactions' own
// TransactionSplit rows (who among the people was credited how much) —
// only at cash totals — so the invoice's own status/paidAmount never
// gets coupled to person-level bookkeeping.
//
// Transitive: after recomputing, if this invoice no longer has enough
// (paidAmount + creditReceived, past its own total) to justify the
// credit it itself gave to a later invoice (creditsGiven, reachable via
// its own payments), that outbound credit is shrunk or deleted to match
// reality, and the target invoice is recomputed too. This has to walk
// forward because a real chain can exist: invoice A overpays and credits
// B; B, now needing less to be fully paid, itself gets overpaid later
// and credits C. Reverting A's payment (e.g. the settlement transaction
// gets deleted) must shrink A→B and cascade into recomputing B, which in
// turn may need to shrink B→C. `visited` is only a guard against a
// pathological cycle — credit only ever flows to a chronologically later
// invoice, so a real cycle shouldn't be reachable.
export async function recomputeInvoiceStatus(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  visited: Set<string> = new Set(),
): Promise<void> {
  if (visited.has(invoiceId)) return;
  visited.add(invoiceId);

  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      transactionInvoices: { include: { transaction: { select: { amount: true } } } },
      payments: {
        select: {
          amount: true,
          paidAt: true,
          creditsGiven: { select: { id: true, amount: true, targetInvoiceId: true } },
        },
      },
      creditsReceived: { select: { amount: true } },
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
  const remaining = total - paidAmount - creditReceived;

  const status =
    remaining > 0.01
      ? paidAmount > 0 || creditReceived > 0
        ? "PARTIALLY_PAID"
        : "OPEN"
      : paidAmount > 0 || creditReceived > 0
        ? "PAID"
        : "OPEN";

  const paidAt = invoice.payments.length
    ? invoice.payments.reduce(
        (latest, payment) => (payment.paidAt > latest ? payment.paidAt : latest),
        invoice.payments[0]!.paidAt,
      )
    : null;

  await tx.invoice.update({
    where: { id: invoiceId },
    data: { status, paidAmount: paidAmount > 0 ? paidAmount : null, paidAt },
  });

  // How much this invoice has actually received beyond its own total is
  // the only thing that can legitimately justify credit it gave onward.
  const justifiableOverflow = Math.max(0, paidAmount + creditReceived - total);
  let budget = justifiableOverflow;
  const creditsGiven = invoice.payments.flatMap((payment) => payment.creditsGiven);

  for (const given of creditsGiven) {
    const amount = given.amount.toNumber();
    if (amount <= budget + 0.01) {
      budget -= amount;
      continue;
    }
    const newAmount = Math.max(0, budget);
    budget = 0;
    if (newAmount <= 0.01) {
      await tx.invoiceCredit.delete({ where: { id: given.id } });
    } else {
      await tx.invoiceCredit.update({ where: { id: given.id }, data: { amount: newAmount } });
    }
    await recomputeInvoiceStatus(tx, given.targetInvoiceId, visited);
  }
}
