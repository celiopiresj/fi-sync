import type { AccountOption } from "../_types/types";
import {
  ALL_CARDS_ACCOUNT_FILTER,
  ALL_NON_CARD_ACCOUNTS_FILTER,
} from "../_constants/constants";

export type AccountKind = "debit" | "credit";

// Which "kind" tab a given `accountId` filter value belongs to — either
// of the group sentinels from _constants/constants.ts, or a specific
// account's own type. Unset (`undefined`) resolves to "debit", the
// screen's default (see transactions-view.tsx's own initialSheetFilters).
// Shared by the Débito/Crédito tabs themselves (which need to know which
// one to show active) and FiltersSheet's own "Limpar filtros" (which
// should broaden back to "every account of this kind" instead of falling
// out of the kind entirely — see that file's own comment).
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
