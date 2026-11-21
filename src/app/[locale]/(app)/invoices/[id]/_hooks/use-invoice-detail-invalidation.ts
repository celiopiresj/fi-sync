"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Isolates TanStack Query cache invalidations out of InvoiceDetailView
// (AGENTS.md: no useQueryClient/invalidateQueries directly inside components).
export function useInvoiceDetailInvalidation() {
  const queryClient = useQueryClient();

  const invalidateAfterPayment = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["credit-card-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["invoice-people-owed"] });
  }, [queryClient]);

  const invalidateAfterTransactionMutation = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["credit-card-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["invoice-people-owed"] });
  }, [queryClient]);

  return {
    invalidateAfterPayment,
    invalidateAfterTransactionMutation,
  };
}
