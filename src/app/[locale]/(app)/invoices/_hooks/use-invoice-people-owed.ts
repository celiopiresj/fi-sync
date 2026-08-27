"use client";

import { useQuery } from "@tanstack/react-query";
import { getInvoicePeopleOwed } from "../actions";

// Feeds pay-invoice-dialog.tsx's manual allocation picker — only fetched
// while the dialog is actually open (`enabled`), since this per-person
// breakdown is only needed once the user enters an amount that differs
// from what's due.
export function useInvoicePeopleOwed(invoiceId: string, enabled: boolean) {
  const { data: peopleOwed = [] } = useQuery({
    queryKey: ["invoice-people-owed", invoiceId],
    queryFn: () => getInvoicePeopleOwed(invoiceId),
    enabled,
  });

  return peopleOwed;
}
