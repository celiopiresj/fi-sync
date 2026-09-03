import type { AccountOption } from "../_types/types";

// Batch entry is debit-only — a credit-card account needs the
// single-transaction form so the invoice/installment logic in
// `createTransaction` actually runs (see actions.ts,
// `resolveInvoiceForDate`). Leaving cards out is what keeps that
// constraint honest instead of silently creating a transaction with no
// invoice link. Investment/pocket accounts are excluded too — aporte/
// resgate against them only ever goes through the dedicated Investments
// screen (investments/actions.ts's own createInvestmentMovement posts
// both transfer legs), never here.
//
// Shared by both batch surfaces (the desktop table and the mobile
// full-screen screen) so the rule lives in one place rather than as two
// filters that can quietly disagree about which account types qualify.
export function filterDebitBatchAccounts(
  accounts: AccountOption[],
): AccountOption[] {
  return accounts.filter(
    (account) =>
      account.type === "CHECKING" ||
      account.type === "SAVINGS" ||
      account.type === "CASH",
  );
}
