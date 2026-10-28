"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createOpenFinanceConnectToken, getOpenFinanceOverview, registerOpenFinanceWidgetConnection } from "../actions";
import { widgetSuccessSchema } from "@/lib/open-finance/schema";
import type { Overview } from "../_types/types";

function usePluggyConnection() {
  const queryClient = useQueryClient();
  const t = useTranslations("scrn-open-finance");
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    if (!syncing) return;
    const timeout = setTimeout(() => setSyncing(false), 60000);
    return () => clearTimeout(timeout);
  }, [syncing]);
  const opening = useMutation({
    mutationFn: createOpenFinanceConnectToken,
    onSuccess: (result) => {
      if (result.error || !result.accessToken) { toast.error(result.error ?? t("errors.widget.description")); return; }
      setConnectToken(result.accessToken);
    },
    onError: () => toast.error(t("errors.widget.description")),
  });
  const registration = useMutation({
    mutationFn: (itemId: string) => registerOpenFinanceWidgetConnection({ itemId }),
    retry: 2,
    onSuccess: async (result) => {
      if (result.error) { toast.error(result.error); return; }
      setPendingItemId(null);
      setSyncing(true);
      await queryClient.invalidateQueries({ queryKey: ["open-finance-overview"] });
      toast.success(t("toast.saved"));
    },
    onError: () => toast.error(t("errors.provider.description")),
  });
  function onSuccess(input: unknown) {
    const parsed = widgetSuccessSchema.safeParse(input);
    if (!parsed.success) { toast.error(t("errors.widget.description")); return; }
    setConnectToken(null);
    setPendingItemId(parsed.data.item.id);
    setSyncing(true);
    registration.mutate(parsed.data.item.id);
  }
  function onClose() {
    setConnectToken(null);
    setSyncing(true);
    void queryClient.invalidateQueries({ queryKey: ["open-finance-overview"] });
  }
  function onError() {
    setConnectToken(null);
    setSyncing(true);
    toast.error(t("errors.widget.description"));
  }
  return {
    connectToken, pendingItemId, syncing, opening: opening.isPending, saving: registration.isPending,
    open: () => opening.mutate(), retry: () => { if (pendingItemId) registration.mutate(pendingItemId); },
    onSuccess, onClose, onError,
  };
}

export function useOpenFinanceScreen(initial: Overview) {
  const connection = usePluggyConnection();
  const query = useQuery({
    queryKey: ["open-finance-overview"], queryFn: getOpenFinanceOverview, initialData: initial,
    refetchOnMount: false, refetchInterval: connection.syncing ? 5000 : false,
  });
  return { overview: query.data, connection };
}
