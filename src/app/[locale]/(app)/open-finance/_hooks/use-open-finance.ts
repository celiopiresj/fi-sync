"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { addOpenFinanceConnection, clearOpenFinanceMapping, createOpenFinancePerson, getOpenFinanceTransactions, getOpenFinanceReview, processOpenFinanceTransaction, saveOpenFinanceMapping, setOpenFinanceConnectionActive } from "../actions";
import type { MappingValues, ProcessValues } from "@/lib/open-finance/schema";
import { existingProcessValues } from "../_lib/existing";
import type { PreviewRow, Source } from "../_types/types";

export function useOpenFinanceMutations() {
  const client = useQueryClient();
  const router = useRouter();
  const t = useTranslations("scrn-open-finance");
  async function onSuccess(result: { error: string | null }) {
    if (result.error) { toast.error(result.error); return; }
    await client.invalidateQueries();
    router.refresh();
    toast.success(t("toast.saved"));
  }
  function onError() { toast.error(t("errors.provider.description")); }
  const add = useMutation({ mutationFn: (value: { label: string; itemId: string }) => addOpenFinanceConnection(value), onSuccess, onError });
  const mapping = useMutation({ mutationFn: (value: MappingValues) => saveOpenFinanceMapping(value), onSuccess, onError });
  const disable = useMutation({ mutationFn: (id: string) => setOpenFinanceConnectionActive(id), onSuccess, onError });
  const process = useMutation({ mutationFn: (value: ProcessValues) => processOpenFinanceTransaction(value), onSuccess, onError });
  const clearMapping = useMutation({ mutationFn: (id: string) => clearOpenFinanceMapping(id), onSuccess, onError });
  const createPerson = useMutation({ mutationFn: (name: string) => createOpenFinancePerson(name), onSuccess, onError });
  return { add, mapping, disable, process, clearMapping, createPerson };
}

// Marks rows as already recorded one by one (each write re-reads the bank
// row on the server), stopping at the first refusal so the owner sees why.
export function useMarkExisting(source: Source) {
  const client = useQueryClient();
  const router = useRouter();
  const t = useTranslations("scrn-open-finance");
  return useMutation({
    mutationFn: async (rows: PreviewRow[]) => {
      let done = 0;
      for (const row of rows) {
        if (row.amount === null) continue;
        const result = await processOpenFinanceTransaction(existingProcessValues(source, { ...row, amount: row.amount }));
        if (result.error) return { done, error: result.error };
        done += 1;
      }
      return { done, error: null };
    },
    onSuccess: async ({ done, error }) => {
      if (done > 0) {
        await client.invalidateQueries({ queryKey: ["open-finance-transactions", source.id] });
        router.refresh();
        toast.success(t("toast.existing", { count: done }));
      }
      if (error) toast.error(error);
    },
    onError: () => toast.error(t("errors.provider.description")),
  });
}

function transactionsKey(sourceId: string, month: string, cursor: string | null) {
  return ["open-finance-transactions", sourceId, month, cursor] as const;
}

export function useOpenFinanceTransactions(sourceId: string, month: string, cursor: string | null) {
  return useQuery({
    queryKey: transactionsKey(sourceId, month, cursor),
    queryFn: () => getOpenFinanceTransactions({ sourceId, month, cursor }), staleTime: 60000,
  });
}

// Reads the first page of each month only from the cache (never fetches),
// so a month tab shows its pending count once it has been opened without
// costing extra provider requests for the months the owner never visits.
export function useOpenFinanceMonthCounts(sourceId: string, months: string[]) {
  const results = useQueries({
    queries: months.map((month) => ({
      queryKey: transactionsKey(sourceId, month, null),
      queryFn: () => getOpenFinanceTransactions({ sourceId, month, cursor: null }),
      enabled: false, staleTime: 60000,
    })),
  });
  return months.map((month, index) => {
    const data = results[index]?.data?.data;
    return { month, count: data ? data.rows.length : null, more: Boolean(data?.next) };
  });
}

export function useOpenFinanceReview(source: Source, transactionId: string | null) {
  return useQuery({
    queryKey: ["open-finance-review", source.id, source.accountId, source.cardId, source.fromDate, transactionId],
    queryFn: () => getOpenFinanceReview({ sourceId: source.id, transactionId }), enabled: Boolean(transactionId), staleTime: 0,
  });
}
