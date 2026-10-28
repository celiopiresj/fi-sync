"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BankIcon, CreditCardIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConnectMeuPluggy } from "./connect-meu-pluggy";
import { useOpenFinanceMutations } from "../_hooks/use-open-finance";
import { sourceDestination } from "../_lib/options";
import type { BanksManagementProps } from "../_types/types";

export function BanksManagement({ overview, connection, open, onSelect }: BanksManagementProps) {
  const t = useTranslations("scrn-open-finance");
  const { disable } = useOpenFinanceMutations();
  const [showInactive, setShowInactive] = useState(false);
  return <section id="open-finance-banks" hidden={!open} aria-labelledby="open-finance-banks-title">
    <Card>
      <CardHeader><CardTitle id="open-finance-banks-title">{t("cards.management.title")}</CardTitle><CardDescription>{t("cards.management.description")}</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-5">
        {overview.configured ? <ConnectMeuPluggy connection={connection} /> : <p className="text-sm text-warning">{t("cards.setup.description")}</p>}
        {overview.connections.filter((entry) => entry.active).map((entry) => <div key={entry.id} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium wrap-break-word">{entry.label}</h3><Button type="button" size="sm" variant="ghost" disabled={disable.isPending} onClick={() => disable.mutate(entry.id)}>{t("buttons.disable")}</Button></div>
          {entry.sources.map((source) => <div key={source.id} className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              {source.type === "CREDIT" ? <CreditCardIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" /> : <BankIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
              <div className="flex min-w-0 flex-col gap-1 text-sm"><span className="wrap-break-word">{source.name}</span><span className="text-xs text-muted-foreground">{t(source.type === "CREDIT" ? "cards.source.credit" : "cards.source.bank")}</span><span className="wrap-break-word text-xs text-muted-foreground">{t("cards.mapping.route", { source: source.name, account: sourceDestination(source, overview.accounts).account?.name ?? t("cards.mapping.unmapped") })}</span></div>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => onSelect(source.id)}>{t(source.accountId ? "cards.management.change" : "cards.management.configure")}</Button>
          </div>)}
        </div>)}
        {overview.connections.some((entry) => !entry.active) && <div className="flex flex-col gap-3 border-t pt-3">
          <Button type="button" variant="ghost" className="self-start" aria-expanded={showInactive} onClick={() => setShowInactive((show) => !show)}>{showInactive ? t("cards.management.hideInactive") : t("cards.management.inactive", { count: overview.connections.filter((entry) => !entry.active).length })}</Button>
          {showInactive && overview.connections.filter((entry) => !entry.active).map((entry) => <div key={entry.id} className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground"><span className="wrap-break-word">{entry.label}</span><span>{t("cards.connections.inactive")}</span></div>)}
        </div>}
        <a className="self-start text-sm text-muted-foreground underline underline-offset-4" href="https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use" target="_blank" rel="noopener noreferrer">{t("buttons.guide")}</a>
      </CardContent>
    </Card>
  </section>;
}
