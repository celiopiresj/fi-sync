"use client";

import { useQuery } from "@tanstack/react-query";
import { getCategoryExpenseBreakdown, type TransactionFilters } from "../actions";

// Takes the screen's full TransactionFilters (same object passed to
// listTransactions) even though getCategoryExpenseBreakdown only reads a
// subset of it — see the comment there for which fields apply and why
// `type` doesn't.
export function useCategoryBreakdown(filters: TransactionFilters) {
  return useQuery({
    queryKey: ["category-breakdown", filters] as const,
    queryFn: () => getCategoryExpenseBreakdown(filters),
  });
}
