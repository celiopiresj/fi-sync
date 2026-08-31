"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listLoans, type LoanFilters } from "../actions";
import type { LoanRow } from "../_types/types";

// Owns the `["loans", filters]` query and its invalidation, so
// LoansView stays declarative (AGENTS.md) — same split as invoices' own
// useInvoicesData.
export function useLoansData(
  filters: LoanFilters,
  initialLoans: LoanRow[],
  useInitialData: boolean,
) {
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["loans", filters] as const, [filters]);
  const { data: loans = initialLoans } = useQuery({
    queryKey,
    queryFn: () => listLoans(filters),
    initialData: useInitialData ? initialLoans : undefined,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["loans"] });
    // Registering/undoing a payment creates/deletes a real Transaction on
    // an account and a Person split, same cross-screen impact
    // useInvoicesData's own invalidate has for payInvoice.
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  }, [queryClient]);

  return { loans, invalidate };
}
