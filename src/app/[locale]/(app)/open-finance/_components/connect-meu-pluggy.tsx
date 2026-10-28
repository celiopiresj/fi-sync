"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { BankIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ConnectionForm } from "./connection-form";
import type { ConnectControlProps } from "../_types/types";

// The SDK initializes browser globals; it must never execute during SSR.
const PluggyConnect = dynamic(() => import("react-pluggy-connect").then((module) => module.PluggyConnect), { ssr: false });

export function ConnectMeuPluggy({ connection }: ConnectControlProps) {
  const t = useTranslations("scrn-open-finance");
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const [manual, setManual] = useState(false);
  return <div className="flex w-full min-w-0 flex-col gap-3 xl:w-auto xl:max-w-2xl">
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
    <Button type="button" variant="ghost" asChild><a href="https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use" target="_blank" rel="noopener noreferrer">{t("buttons.guide")}</a></Button>
    <Button type="button" variant="outline" aria-expanded={manual} onClick={() => setManual((value) => !value)}>{t("cards.connect.manual")}</Button>
    <Button type="button" onClick={connection.open} disabled={connection.opening || connection.saving || Boolean(connection.connectToken) || Boolean(connection.pendingItemId)}>
      <BankIcon />
      {connection.opening ? t("cards.connect.opening") : connection.saving ? t("cards.connect.saving") : t("cards.connect.button")}
    </Button>
    </div>
    {connection.pendingItemId && !connection.saving && <Button type="button" variant="outline" onClick={connection.retry}>{t("cards.connect.retry")}</Button>}
    {connection.syncing && <p role="status" className="text-sm text-muted-foreground">{t("cards.connect.syncing")}</p>}
    {connection.failure && <div role="alert" className="flex flex-col gap-1 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
      <span className="font-medium">{t(`errors.${connection.failure.reason}.title`)}</span>
      <p>{t(`errors.${connection.failure.reason}.description`)}</p>
      {connection.failure.code && <p className="font-mono text-xs wrap-break-word">{t("errors.widget.code", { code: connection.failure.code })}</p>}
    </div>}
    {connection.connectToken && <PluggyConnect
      connectToken={connection.connectToken}
      connectorIds={[200]}
      selectedConnectorId={200}
      includeSandbox={false}
      allowConnectInBackground={false}
      language={locale === "pt-BR" ? "pt" : "en"}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      onSuccess={connection.onSuccess}
      onClose={connection.onClose}
      onError={connection.onError}
      onLoadError={connection.onLoadError}
      onEvent={connection.onEvent}
    />}
    {manual && <ConnectionForm />}
  </div>;
}
