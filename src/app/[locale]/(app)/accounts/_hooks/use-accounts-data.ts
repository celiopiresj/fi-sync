"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listAccounts } from "../actions";
import type { AccountRow } from "../_types/types";

// Owns the `["accounts"]` query and its invalidation so AccountsView
// itself stays declarative (see "Screens and components stay
// declarative" in AGENTS.md) — the view calls this hook and gets back
// data + a ready-to-call invalidator, no `useQueryClient()`/`useQuery()`
// of its own.
export function useAccountsData(initialAccounts: AccountRow[]) {
  const queryClient = useQueryClient();

  const { data: accounts = initialAccounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => listAccounts(),
    initialData: initialAccounts,
  });

  function invalidateAccounts() {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  }

  return { accounts, invalidateAccounts };
}
