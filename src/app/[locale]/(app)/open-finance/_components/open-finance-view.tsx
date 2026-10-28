"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BankIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/screen/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOpenFinanceMutations } from "../_hooks/use-open-finance";
import { mappedSources } from "../_lib/options";
import { ConnectMeuPluggy } from "./connect-meu-pluggy";
import { useOpenFinanceScreen } from "../_hooks/use-pluggy-connection";
import { MappingForm } from "./mapping-form";
import { TransactionTable } from "./transaction-table";
import type { ViewProps } from "../_types/types";

export function OpenFinanceView({ overview: initialOverview }: ViewProps) {
  const t = useTranslations("scrn-open-finance");
  const { overview, connection } = useOpenFinanceScreen(initialOverview);
  const [sourceId, setSourceId] = useState("");
  const { disable } = useOpenFinanceMutations();
  const sources = mappedSources(overview);
  const source = sources.find((entry) => entry.id === sourceId);
  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Card>
        <CardHeader><CardTitle>{t("cards.connect.title")}</CardTitle><CardDescription>{t("description")}</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button variant="outline" asChild><a href="https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use" target="_blank" rel="noopener noreferrer">{t("buttons.guide")}</a></Button>
          {overview.configured ? <ConnectMeuPluggy connection={connection} /> : <div className="flex flex-col gap-1 text-warning"><span className="font-medium">{t("cards.setup.title")}</span><p className="text-sm">{t("cards.setup.description")}</p></div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("cards.connections.title")}</CardTitle><CardDescription>{t("cards.connect.description")}</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {overview.connections.length === 0 && <Empty><EmptyHeader><EmptyMedia variant="icon"><BankIcon /></EmptyMedia><EmptyTitle>{t("cards.connections.empty")}</EmptyTitle><EmptyDescription>{t("cards.connections.description")}</EmptyDescription></EmptyHeader></Empty>}
          {overview.connections.map((connection) => <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <span className="min-w-0 wrap-break-word text-sm font-medium">{connection.label}</span>
            {connection.active ? <Button variant="outline" size="sm" disabled={disable.isPending} onClick={() => disable.mutate(connection.id)}>{t("buttons.disable")}</Button> : <span className="text-xs text-muted-foreground">{t("cards.connections.inactive")}</span>}
          </div>)}
          {sources.length > 0 && <div className="flex flex-col gap-1.5">
            <label htmlFor="open-finance-source" className="text-sm font-medium">{t("fields.source.label")}</label>
            <Select value={sourceId} onValueChange={setSourceId}><SelectTrigger id="open-finance-source" className="w-full"><SelectValue placeholder={t("fields.source.placeholder")} /></SelectTrigger><SelectContent>
              {overview.connections.filter((connection) => connection.active).flatMap((connection) => connection.sources.map((entry) => <SelectItem key={entry.id} value={entry.id}>{t("fields.source.option", { bank: connection.label, account: entry.name })}</SelectItem>))}
            </SelectContent></Select>
          </div>}
        </CardContent>
      </Card>
      {source && <MappingForm key={`${source.id}:${source.accountId}:${source.cardId}:${source.fromDate}`} source={source} accounts={overview.accounts} />}
      {source?.accountId && source.fromDate && overview.configured && <Card>
        <CardHeader><CardTitle>{t("cards.review.title")}</CardTitle><CardDescription>{t("cards.review.description")}</CardDescription></CardHeader>
        <CardContent><TransactionTable key={`${source.id}:${source.accountId}:${source.cardId}:${source.fromDate}`} source={source} /></CardContent>
      </Card>}
    </div>
  );
}
