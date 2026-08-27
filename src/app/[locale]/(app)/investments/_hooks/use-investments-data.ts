"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listInvestmentAccounts } from "../actions";
import type { InvestmentAccountRow } from "../_types/types";

// Owns the `["investment-accounts"]` query and its invalidation so
// InvestmentsView itself stays declarative (AGENTS.md) — same shape as
// accounts/_hooks/use-accounts-data.ts.
export function useInvestmentsData(initialAccounts: InvestmentAccountRow[]) {
  const queryClient = useQueryClient();

  const { data: accounts = initialAccounts } = useQuery({
    queryKey: ["investment-accounts"],
    queryFn: () => listInvestmentAccounts(),
    initialData: initialAccounts,
  });

  function invalidateInvestments() {
    queryClient.invalidateQueries({ queryKey: ["investment-accounts"] });
  }

  return { accounts, invalidateInvestments };
}
