"use client";

import { useQuery } from "@tanstack/react-query";
import { getCategoryExpenseBreakdown } from "../../transactions/actions";
import type { AccountKind, CategoryBreakdown } from "../_types/types";

// Owns the ["spending", from, to, accountKind] query so the view stays
// declarative — same pattern as transactions' own useCategoryBreakdown,
// specialized to this screen's two inputs (period + Débito/Crédito
// lens) instead of the full TransactionFilters shape. `initialBreakdown`
// seeds the cache for the default period/lens page.tsx itself fetched,
// so the first render doesn't refetch data it already has.
export function useSpendingData(params: {
  from: string;
  to: string;
  accountId: string;
  accountKind: AccountKind;
  initialBreakdown: CategoryBreakdown | null;
  useInitialData: boolean;
}) {
  const { from, to, accountId, accountKind, initialBreakdown, useInitialData } = params;

  const { data } = useQuery({
    queryKey: ["spending", from, to, accountKind] as const,
    queryFn: () => getCategoryExpenseBreakdown({ from, to, accountId }),
    initialData: useInitialData ? (initialBreakdown ?? undefined) : undefined,
  });

  return { breakdown: data ?? null };
}
