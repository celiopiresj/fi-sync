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
    // Paying an invoice changes the credit card's available limit shown
    // on /cards (limit minus every unpaid/partially-paid invoice's own
    // remaining due — see cards/actions.ts's listCreditCardAccounts) and,
    // since it now also creates an expense Transaction on the chosen
    // account (see payInvoice in actions.ts), that account's balance on
    // /accounts.
    queryClient.invalidateQueries({ queryKey: ["credit-card-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    // Who still owes what on whichever invoice was just paid may have
    // changed — no specific id to scope to here (this hook doesn't know
    // which invoice triggered the invalidation), so this invalidates
    // every cached breakdown; pay-invoice-dialog.tsx only ever queries
    // one at a time anyway.
    queryClient.invalidateQueries({ queryKey: ["invoice-people-owed"] });
  }, [queryClient]);

  return { invoices, invalidate };
}
