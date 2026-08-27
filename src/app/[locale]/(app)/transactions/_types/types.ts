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

// The subset of TransactionFilters that FiltersSheet itself edits, plus
// `dateFrom`/`dateTo` — an optional custom range that, when set,
// overrides the header period stepper's own from/to on whichever side
// is set (transactions-view.tsx's own `filters` useMemo does the
// override). `search` lives outside the sheet — the action bar's own
// search input owns that, merging its piece into the full
// TransactionFilters passed to listTransactions. Keeping this as a
// named type (rather than each file redeclaring its own ad-hoc shape)
// is what keeps the sheet's props and the parent's state from drifting
// apart.
export type SheetFilters = Pick<
  TransactionFilters,
  "accountId" | "categoryId" | "personId" | "type"
> & {
  dateFrom?: string;
  dateTo?: string;
};
