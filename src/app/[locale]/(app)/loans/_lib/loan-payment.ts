// Which way a payment's real amount differs from the nominal amount
// owed — "interest" when more was paid (a late fee/negotiated
// surcharge), "discount" when less (an early-payment rebate), "none"
// when they match. Purely a classification of the difference, never a
// user-typed value — see registerLoanPaymentSchema's own comment
// (_schema/schema.ts) for why the form asks for the amount actually
// paid instead of an adjustment figure.
export const loanPaymentAdjustmentTypeValues = ["none", "interest", "discount"] as const;
export type LoanPaymentAdjustmentType = (typeof loanPaymentAdjustmentTypeValues)[number];

export type LoanPaymentAdjustment = {
  type: LoanPaymentAdjustmentType;
  amount: number;
};

// Compares what was actually paid against the nominal amount owed (one
// installment's `amount`, or the summed remaining balance for an early
// settlement) and classifies the difference. Cents-based rather than a
// plain float comparison — same reasoning as every other money
// computation in this app (AGENTS.md's money-values convention) — so a
// paid amount typed as exactly equal to the nominal one never reads as
// "R$0,00 de juros" over a float rounding artifact.
//
// Pure, no DB dependency — shared by the payment dialogs' own live
// preview and the Server Actions that build the settlement
// Transaction(s)' description (registerLoanPayment /
// settleRemainingLoanInstallments, both in actions.ts), so the client
// and the server can never disagree about whether a payment counted as
// interest or as a discount.
export function classifyLoanPaymentAdjustment(
  nominalAmount: number,
  paidAmount: number,
): LoanPaymentAdjustment {
  const diffCents = Math.round(paidAmount * 100) - Math.round(nominalAmount * 100);
  if (diffCents === 0) return { type: "none", amount: 0 };
  return {
    type: diffCents > 0 ? "interest" : "discount",
    amount: Math.abs(diffCents) / 100,
  };
}
