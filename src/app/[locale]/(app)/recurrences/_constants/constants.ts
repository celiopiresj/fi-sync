// Sentinel `accountId` filter values for the recurrences list — same
// meaning (and same values) as transactions' own _constants/constants.ts,
// duplicated rather than imported since `_constants` is a private,
// per-route folder (AGENTS.md). Let the Débito/Crédito tabs scope the
// list to every card, or every non-card account, without adding a
// separate filter dimension. Shared between the filter UI
// (filters-sheet.tsx, recurrences-view.tsx) and listRecurrences
// (actions.ts), which interprets them.
export const ALL_CARDS_ACCOUNT_FILTER = "__all_cards__";
export const ALL_NON_CARD_ACCOUNTS_FILTER = "__all_non_card_accounts__";

// True for either sentinel above — "just which Débito/Crédito tab is
// active," not a real narrowing (FiltersSheet's badge count, the chip
// row). Same rule as transactions' own isAccountGroupFilter.
export function isAccountGroupFilter(accountId: string | undefined): boolean {
  return accountId === ALL_CARDS_ACCOUNT_FILTER || accountId === ALL_NON_CARD_ACCOUNTS_FILTER;
}
