import type { AccountOption } from "../_types/types";
import type { AccountKind } from "./account-kind";

// Accounts a single-transaction form may offer, split by form kind
// (tasks/015.md: debit and credit are separate forms with separate
// account pickers). Debit is checking/savings/cash only — investment/
// pocket accounts go through the Investments screen instead (its own
// createInvestmentMovement posts both transfer legs). Archived accounts
// are dropped, except the one a row being edited already points at, so
// opening an old transaction doesn't silently blank its account.
//
// Shared by /transactions' own sheets and the mobile FAB drawer
// (add-transaction-drawer.tsx), which previously passed the unfiltered
// list straight through — offering checking accounts in the card form
// and cards in the debit form.
export function filterSelectableAccounts(
  accounts: AccountOption[],
  kind: AccountKind,
  editingAccountId?: string,
): AccountOption[] {
  return accounts.filter(
    (account) =>
      (kind === "credit"
        ? account.type === "CREDIT_CARD"
        : account.type === "CHECKING" ||
          account.type === "SAVINGS" ||
          account.type === "CASH") &&
      (account.status === "ACTIVE" || account.id === editingAccountId),
  );
}
