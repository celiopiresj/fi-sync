"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBudgetWithSpending } from "../actions";
import type { BudgetWithSpending } from "../_types/types";

// Owns the `["budgets", month]` query so the view stays declarative.
// `initialBudget` seeds the cache for the default period (same pattern
// as transactions' `useTransactionsData`).
export function useBudgetData(
  month: string,
  initialBudget: BudgetWithSpending | null,
  useInitialData: boolean,
) {
  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () => ["budgets", month] as const,
    [month],
  );

  const { data: budget } = useQuery({
    queryKey,
    queryFn: () => getBudgetWithSpending(month),
    initialData: useInitialData ? (initialBudget ?? undefined) : undefined,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
  }, [queryClient]);

  return { budget: budget ?? null, invalidate };
}
