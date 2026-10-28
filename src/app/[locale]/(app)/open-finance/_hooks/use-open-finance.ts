"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { addOpenFinanceConnection, clearOpenFinanceMapping, getOpenFinanceTransactions, getOpenFinanceReview, processOpenFinanceTransaction, saveOpenFinanceMapping, setOpenFinanceConnectionActive } from "../actions";
import type { MappingValues, ProcessValues } from "@/lib/open-finance/schema";

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
  return { add, mapping, disable, process, clearMapping };
}

export function useOpenFinanceTransactions(sourceId: string, cursor: string | null) {
  return useQuery({
    queryKey: ["open-finance-transactions", sourceId, cursor],
    queryFn: () => getOpenFinanceTransactions({ sourceId, cursor }), staleTime: 60000,
  });
}

export function useOpenFinanceReview(sourceId: string, transactionId: string | null) {
  return useQuery({
    queryKey: ["open-finance-review", sourceId, transactionId],
    queryFn: () => getOpenFinanceReview({ sourceId, transactionId }), enabled: Boolean(transactionId), staleTime: 0,
  });
}
