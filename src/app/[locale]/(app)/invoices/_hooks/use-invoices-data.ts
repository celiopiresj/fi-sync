"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listInvoices, type InvoiceFilters } from "../actions";
import type { InvoiceRow } from "../_types/types";

// Owns the `["invoices", filters]` query and its invalidation, so
// InvoicesView stays declarative (AGENTS.md) — same split as
// recurrences' own useRecurrencesData. `useInitialData` opts out of
// seeding `initialData` once the client-side filters no longer match
// what page.tsx originally fetched (unfiltered), mirroring
// transactions-view.tsx's own `isDefaultFilters`.
export function useInvoicesData(
  filters: InvoiceFilters,
  initialInvoices: InvoiceRow[],
  useInitialData: boolean,
) {
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["invoices", filters] as const, [filters]);
  const { data: invoices = initialInvoices } = useQuery({
    queryKey,
    queryFn: () => listInvoices(filters),
    initialData: useInitialData ? initialInvoices : undefined,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    // Marking an invoice as paid changes the credit card's available
    // limit shown on /cards (limit minus every unpaid invoice — see
    // cards/actions.ts's listCreditCardAccounts) and, since it now also
    // creates an expense Transaction on the chosen account (see
    // markInvoicePaid in actions.ts), that account's balance on /accounts.
    queryClient.invalidateQueries({ queryKey: ["credit-card-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  }, [queryClient]);

  return { invoices, invalidate };
}
