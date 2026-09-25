// A handful of Transaction rows aren't "a normal lançamento" at all —
// they're the real, persisted side effect of a different screen's own
// action (an account's opening balance, an investment movement, a loan
// installment being settled, a card invoice being paid). Each one is
// tracked and edited from its own dedicated screen, which already knows
// how to keep it consistent with the thing it belongs to (LoanInstallment,
// InvoicePayment, the investment account's own running balance, ...) —
// the plain debit/credit transaction form has no idea any of that exists,
// so letting it edit one of these rows directly (change its amount,
// re-categorize it, delete its splits) would silently desync whatever
// screen actually owns it. Detected here so the transactions list can
// redirect to that screen instead of opening the normal edit form.
//
// `transfer` is the one kind with no screen of its own to redirect to:
// it's either leg of an account-to-account transfer, and editing one
// leg alone (amount, date, account) would leave the other describing a
// movement that no longer happened. The way to change one is delete
// (both legs go together — see deleteTransaction) and record it again.
export type SpecialTransactionKind =
  | { kind: "initialBalance" }
  | { kind: "investmentMovement"; accountId: string }
  | { kind: "loanInstallment"; loanId: string }
  | { kind: "invoicePayment"; invoiceId: string }
  | { kind: "transfer" };

export function resolveSpecialTransactionKind(row: {
  accountId: string;
  isInitialBalance: boolean;
  investmentMovementKind: string | null;
  loanInstallment: { loanId: string } | null;
  invoicePayment: { invoiceId: string } | null;
  transferGroupId: string | null;
}): SpecialTransactionKind | null {
  // Checked in this order since a row can only ever really match one of
  // these (an initial-balance row is never also a loan settlement, etc.)
  // — order only matters as a tie-breaker if that invariant is ever
  // broken elsewhere.
  if (row.isInitialBalance) return { kind: "initialBalance" };
  if (row.investmentMovementKind) {
    return { kind: "investmentMovement", accountId: row.accountId };
  }
  if (row.loanInstallment) {
    return { kind: "loanInstallment", loanId: row.loanInstallment.loanId };
  }
  if (row.invoicePayment) {
    return { kind: "invoicePayment", invoiceId: row.invoicePayment.invoiceId };
  }
  // After investmentMovement on purpose: an aporte/resgate's investment-
  // side leg also carries a transferGroupId, and that one does have a
  // screen to send the user to. Its checking-side leg has no
  // investmentMovementKind and lands here — protected the same way.
  if (row.transferGroupId) return { kind: "transfer" };
  return null;
}
