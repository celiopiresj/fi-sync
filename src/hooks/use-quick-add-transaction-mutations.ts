"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import {
  createCreditTransaction,
  createCreditTransactionsBatch,
  createDebitTransaction,
  createTransactionsBatch,
  createTransfer,
} from "@/app/[locale]/(app)/transactions/actions";

// Mirrors transactions-view.tsx's own handleSubmitDebit/handleSubmitCredit
// (create-only here — the FAB never edits) and the exact same
// invalidation set as use-transactions-data.ts's invalidate(). Plus one
// thing that hook doesn't need: router.refresh(), since Home and /wallet
// are server-rendered with no TanStack Query of their own (see
// (home)/actions.ts, wallet/actions.ts) — without it, a transaction
// created from the FAB while looking at either of those wouldn't show up
// until a manual reload.
export function useQuickAddTransactionMutations() {
  const t = useTranslations("scrn-transactions");
  const queryClient = useQueryClient();
  const router = useRouter();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["monthly-balances"] });
    queryClient.invalidateQueries({ queryKey: ["category-breakdown"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["credit-card-accounts"] });
    router.refresh();
  }, [queryClient, router]);

  const submitDebit = useCallback(
    async (values: Parameters<typeof createDebitTransaction>[0]) => {
      const result = await createDebitTransaction(values);
      if (!result.error) {
        invalidate();
        toast.success(t("toast.created"));
      }
      return result;
    },
    [invalidate, t],
  );

  const submitCredit = useCallback(
    async (
      values: Parameters<typeof createCreditTransaction>[0],
      options?: Parameters<typeof createCreditTransaction>[1],
    ) => {
      const result = await createCreditTransaction(values, options);
      if (!result.error) {
        invalidate();
        toast.success(t("toast.created"));
      }
      return result;
    },
    [invalidate, t],
  );

  // Unlike the two above, the toast is left to the caller's onSuccess —
  // a batch reports how many rows it created, which this hook doesn't
  // know until the action returns without an error.
  const submitBatch = useCallback(
    async (rows: Parameters<typeof createTransactionsBatch>[0]) => {
      const result = await createTransactionsBatch(rows);
      if (!result.error) invalidate();
      return result;
    },
    [invalidate],
  );

  // Credit-card counterpart of submitBatch above — same "the caller
  // toasts, since only it knows the row count" convention. Used by the
  // fatura import, whose rows are always card purchases; the manual
  // batch step is debit-only (see filterDebitBatchAccounts).
  const submitCreditBatch = useCallback(
    async (rows: Parameters<typeof createCreditTransactionsBatch>[0]) => {
      const result = await createCreditTransactionsBatch(rows);
      if (!result.error) invalidate();
      return result;
    },
    [invalidate],
  );

  // A transfer moves two accounts' balances at once (or one account and a
  // person's balance), so it needs the same full invalidation — and its
  // own toast, since "transação criada" undersells a movement between
  // two places.
  const submitTransfer = useCallback(
    async (values: Parameters<typeof createTransfer>[0]) => {
      const result = await createTransfer(values);
      if (!result.error) {
        invalidate();
        toast.success(t("toast.transferCreated"));
      }
      return result;
    },
    [invalidate, t],
  );

  return {
    submitDebit,
    submitCredit,
    submitBatch,
    submitCreditBatch,
    submitTransfer,
  };
}
