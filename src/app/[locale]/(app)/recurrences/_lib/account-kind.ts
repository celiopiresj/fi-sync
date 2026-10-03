import type { AccountOption } from "../_types/types";
import {
  ALL_CARDS_ACCOUNT_FILTER,
  ALL_NON_CARD_ACCOUNTS_FILTER,
} from "../_constants/constants";

export type AccountKind = "debit" | "credit";

// Which Débito/Crédito tab a given `accountId` filter value belongs to —
// mirrors transactions' own _lib/account-kind.ts. Unset resolves to
// "debit", the screen's default (see recurrences-view.tsx's own
// DEFAULT_SHEET_FILTERS).
export function resolveAccountKind(
  accountId: string | undefined,
  accounts: AccountOption[],
): AccountKind {
  if (accountId === ALL_CARDS_ACCOUNT_FILTER) return "credit";
  if (accountId === ALL_NON_CARD_ACCOUNTS_FILTER) return "debit";
  const account = accounts.find((candidate) => candidate.id === accountId);
  return account?.type === "CREDIT_CARD" ? "credit" : "debit";
}

// The group sentinel — "every account of this kind" — a tab click (or a
// filter reset) sets `accountId` to.
export function accountIdForKind(kind: AccountKind): string {
  return kind === "credit" ? ALL_CARDS_ACCOUNT_FILTER : ALL_NON_CARD_ACCOUNTS_FILTER;
}
