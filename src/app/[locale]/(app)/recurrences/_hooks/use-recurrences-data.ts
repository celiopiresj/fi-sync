"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listRecurrences, type RecurrenceFilters } from "../actions";
import type { RecurrenceRow } from "../_types/types";

// Owns the `["recurrences", filters]` query and its invalidation, so
// RecurrencesView stays declarative (AGENTS.md: "Screens and components
// stay declarative") instead of calling useQuery/useQueryClient itself —
// same split as transactions' useTransactionsData. No "previous period"
// counterpart query here: recurrences aren't scoped to a month at all
// (see the SheetFilters comment in _schema/schema.ts), so there's no
// month-over-month comparison to fetch. `useInitialData` lets the caller
// opt out of seeding `initialData` from the server-rendered props once
// the client-side filters no longer match what the server originally
// fetched (mirrors transactions-view.tsx's `isDefaultFilters`).
export function useRecurrencesData(
  filters: RecurrenceFilters,
  initialRecurrences: RecurrenceRow[],
  useInitialData: boolean,
) {
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["recurrences", filters] as const, [filters]);
  const { data: recurrences = initialRecurrences } = useQuery({
    queryKey,
    queryFn: () => listRecurrences(filters),
    initialData: useInitialData ? initialRecurrences : undefined,
  });

  // Stable across renders (useQueryClient()'s own return value never
  // changes) — same reasoning as transactions' own invalidate: whatever
  // closes over this shouldn't recompute just because this function's
  // identity churned.
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["recurrences"] });
    // A recurrence create/edit/delete also creates/updates/deletes real
    // Transaction rows (the generated or cascaded occurrences) — the
    // transactions screen's own queries need to hear about that too, or
    // it'd keep showing stale amounts/rows until something else
    // happened to trigger a refetch over there.
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["monthly-balances"] });
    queryClient.invalidateQueries({ queryKey: ["category-breakdown"] });
  }, [queryClient]);

  return { recurrences, invalidate };
}
