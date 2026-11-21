"use client";

import { useQuery } from "@tanstack/react-query";
import {
  previewCurrentInvoiceCycle,
  previewInstallmentCycles,
  previewInvoiceCycle,
} from "../actions";

// Isolates the three credit-card invoice preview queries out of
// CreditTransactionForm and CreditBatchTransactionTable (AGENTS.md:
// every useQuery lives in _hooks/use-*.ts, never in a component body).
export function useCreditInvoicePreview(
  scope: "single" | "batch",
  accountId: string,
  date: string,
  installmentCount: number,
) {
  const { data: invoicePreview } = useQuery({
    queryKey: [`credit-${scope}-invoice-preview`, accountId, date],
    queryFn: () => previewInvoiceCycle(accountId, date),
    enabled: Boolean(accountId) && Boolean(date),
  });

  const installmentCyclesQuery = useQuery({
    queryKey: [
      `credit-${scope}-installment-cycles`,
      accountId,
      date,
      installmentCount,
    ],
    queryFn: () => previewInstallmentCycles(accountId, date, installmentCount),
    enabled: Boolean(accountId) && Boolean(date) && installmentCount > 1,
  });

  const { data: currentInvoiceCycle } = useQuery({
    queryKey: [`credit-${scope}-current-invoice-cycle`, accountId],
    queryFn: () => previewCurrentInvoiceCycle(accountId),
    enabled: Boolean(accountId) && installmentCount > 1,
  });

  return { invoicePreview, installmentCyclesQuery, currentInvoiceCycle };
}
