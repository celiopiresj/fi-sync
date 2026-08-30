// Sentinel `accountId` filter values for the transactions list's "Conta"
// select — let it filter by ACCOUNT TYPE (every card, or every non-card
// account) in addition to one specific account/card, without adding a
// separate filter dimension. Real account/card ids are cuids and can
// never collide with these. Shared between the filter UI
// (filters-sheet.tsx, transactions-view.tsx) and the server-side query
// (actions.ts) that interprets them.
export const ALL_CARDS_ACCOUNT_FILTER = "__all_cards__";
export const ALL_NON_CARD_ACCOUNTS_FILTER = "__all_non_card_accounts__";
