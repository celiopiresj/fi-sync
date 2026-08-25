"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listCreditCardAccounts } from "../actions";
import type { CreditCardAccountRow } from "../_types/types";

// Owns the `["credit-card-accounts"]` query and its invalidation so
// CardsView itself stays declarative (AGENTS.md) — same split as
// accounts/_hooks/use-accounts-data.ts.
export function useCardsData(initialAccounts: CreditCardAccountRow[]) {
  const queryClient = useQueryClient();

  const { data: accounts = initialAccounts } = useQuery({
    queryKey: ["credit-card-accounts"],
    queryFn: () => listCreditCardAccounts(),
    initialData: initialAccounts,
  });

  function invalidateCards() {
    queryClient.invalidateQueries({ queryKey: ["credit-card-accounts"] });
  }

  return { accounts, invalidateCards };
}
