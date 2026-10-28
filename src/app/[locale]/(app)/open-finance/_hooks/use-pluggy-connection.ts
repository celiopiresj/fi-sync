"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createOpenFinanceConnectToken, getOpenFinanceOverview, registerOpenFinanceWidgetConnection } from "../actions";
import { widgetSuccessSchema } from "@/lib/open-finance/schema";
import type { Overview, WidgetFailure } from "../_types/types";
import { failureFromWidgetEvent, widgetFailure } from "../_lib/widget-errors";

function usePluggyConnection() {
  const queryClient = useQueryClient();
  const t = useTranslations("scrn-open-finance");
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [failure, setFailure] = useState<WidgetFailure | null>(null);
  useEffect(() => {
    if (!syncing) return;
    const timeout = setTimeout(() => setSyncing(false), 60000);
    return () => clearTimeout(timeout);
  }, [syncing]);
  const opening = useMutation({
    mutationFn: createOpenFinanceConnectToken,
    onMutate: () => setFailure(null),
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
    setFailure(null);
    setPendingItemId(parsed.data.item.id);
    setSyncing(true);
    registration.mutate(parsed.data.item.id);
  }
  function onClose() {
    setConnectToken(null);
    setSyncing(true);
    void queryClient.invalidateQueries({ queryKey: ["open-finance-overview"] });
  }
  function onError(input: unknown) {
    const next = widgetFailure(input);
    setFailure((previous) => next.code || !previous ? next : previous);
    if (!next.keepOpen) setConnectToken(null);
    // Keep the iframe mounted: Pluggy owns its error/retry screen, and
    // unmounting here also destroys the failed response in DevTools.
    setSyncing(next.reason === "widgetAuthorization");
  }
  function onLoadError(input: unknown) {
    const next = widgetFailure(input, "load");
    setFailure(next);
    setConnectToken(null);
    toast.error(t("errors.widgetLoad.description"));
  }
  function onEvent(input: unknown) {
    const next = failureFromWidgetEvent(input);
    if (next) setFailure(next);
  }
  return {
    connectToken, pendingItemId, syncing, failure, opening: opening.isPending, saving: registration.isPending,
    open: () => opening.mutate(), retry: () => { if (pendingItemId) registration.mutate(pendingItemId); },
    onSuccess, onClose, onError, onLoadError, onEvent,
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
