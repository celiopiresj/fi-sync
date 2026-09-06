// Sentinel `accountId` filter values for the transactions list's "Conta"
// select — let it filter by ACCOUNT TYPE (every card, or every non-card
// account) in addition to one specific account/card, without adding a
// separate filter dimension. Real account/card ids are cuids and can
// never collide with these. Shared between the filter UI
// (filters-sheet.tsx, transactions-view.tsx) and the server-side query
// (actions.ts) that interprets them.
export const ALL_CARDS_ACCOUNT_FILTER = "__all_cards__";
export const ALL_NON_CARD_ACCOUNTS_FILTER = "__all_non_card_accounts__";

// True for either sentinel above — a group filter still spans many
// different accounts, unlike one picked by real id. Distinguishes "an
// account filter is actually narrowing the list" (FiltersSheet's active-
// filter badge/count, the chip row) from "just which kind of account
// this screen's Débito/Crédito tabs are scoped to" (transactions-view.tsx),
// and gates whether the table's own Account column is redundant — it
// only is once every visible row shares the exact same account, which a
// group sentinel alone doesn't guarantee.
export function isAccountGroupFilter(accountId: string | undefined): boolean {
  return accountId === ALL_CARDS_ACCOUNT_FILTER || accountId === ALL_NON_CARD_ACCOUNTS_FILTER;
}

// The installment counts a chip picker can offer. Fixed 1–24: no card
// realistically bills more, and a ChipSelect needs a bounded option list
// (unlike the single credit form's free-typed TextField). Shared by the
// credit batch table's draft card and the fatura import's row editor so
// the two can't drift on the ceiling.
export const INSTALLMENT_OPTIONS = Array.from({ length: 24 }, (_, i) =>
  String(i + 1),
);
