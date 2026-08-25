"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listTransactions, type TransactionFilters } from "../actions";
import type { TransactionRow } from "../_types/types";

// Owns the current-period + previous-period `["transactions", ...]`
// queries and their shared invalidation, so TransactionsView stays
// declarative (see "Screens and components stay declarative" in
// AGENTS.md) instead of calling `useQuery`/`useQueryClient` itself.
// `useInitialData` lets the caller opt out of seeding `initialData` from
// the server-rendered props once the client-side filters/period no
// longer match what the server originally fetched — see the
// `isDefaultFilters` comment in transactions-view.tsx.
export function useTransactionsData(
  filters: TransactionFilters,
  previousFilters: TransactionFilters,
  initialTransactions: TransactionRow[],
  useInitialData: boolean,
) {
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["transactions", filters] as const, [filters]);
  const { data: transactions = initialTransactions } = useQuery({
    queryKey,
    queryFn: () => listTransactions(filters),
    initialData: useInitialData ? initialTransactions : undefined,
  });

  // No initialData: the server never pre-fetches the previous period, so
  // this is `undefined` (loading) until it resolves — SummaryCards
  // renders that as "still loading", not "no data".
  const { data: previousTransactions } = useQuery({
    queryKey: ["transactions", previousFilters] as const,
    queryFn: () => listTransactions(previousFilters),
  });

  // Stable across renders (useQueryClient()'s own return value never
  // changes, so `[queryClient]` only ever runs this once) — bulk actions'
  // memoized config (transactions-view.tsx's `tableSelection`) closes
  // over `invalidate`, and a fresh function identity every render would
  // have defeated that memo just as surely as an unmemoized object would.
  const invalidate = useCallback(() => {
    // Matches every "transactions"-prefixed key — both the current and
    // previous-period queries above — so a create/edit/delete can't
    // leave the comparison figure stale. Also covers the summary card's
    // two chart queries (use-monthly-balances.ts, use-category-
    // breakdown.ts) — without these, the monthly-balance bars and the
    // category breakdown would keep showing pre-mutation totals until
    // something else happened to trigger a refetch.
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["monthly-balances"] });
    queryClient.invalidateQueries({ queryKey: ["category-breakdown"] });
    // A credit-card transaction (tasks/015.md reunited these on this
    // screen) also affects the invoice it landed in (/invoices) and the
    // credit card's available limit shown on /cards — harmless no-ops
    // when the mutation was actually a debit transaction.
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["credit-card-accounts"] });
  }, [queryClient]);

  return { transactions, previousTransactions, invalidate };
}
