import type {
  listTransactions,
  getTransactionFormOptions,
  TransactionFilters,
  MonthlyBalance,
  CategoryBreakdown,
  CategoryBreakdownItem,
} from "../actions";

export type { MonthlyBalance, CategoryBreakdown, CategoryBreakdownItem };

export type TransactionRow = Awaited<ReturnType<typeof listTransactions>>[number];
export type TransactionFormOptions = Awaited<
  ReturnType<typeof getTransactionFormOptions>
>;
export type AccountOption = TransactionFormOptions["accounts"][number];
export type CategoryOption = TransactionFormOptions["categories"][number];
export type PersonOption = TransactionFormOptions["people"][number];
// Nested off AccountOption (accounts are fetched with `include: { cards:
// true }`) rather than a separate top-level list — every account carries
// its own `cards` (empty for non-CREDIT_CARD accounts), used by
// CreditTransactionForm's card picker.
export type CardOption = AccountOption["cards"][number];

// The subset of TransactionFilters that FiltersSheet itself edits.
// `search` and the period range (`from`/`to`) live outside the sheet now
// — the action bar's own search input and the header's period stepper
// (transactions-view.tsx) own those respectively, each merging its piece
// into the full TransactionFilters passed to listTransactions. Keeping
// this as a named Pick (rather than each file redeclaring its own
// ad-hoc shape) is what keeps the sheet's props and the parent's state
// from drifting apart.
export type SheetFilters = Pick<TransactionFilters, "accountId" | "categoryId" | "type">;
