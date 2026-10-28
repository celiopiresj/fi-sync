"use client";

import { useTranslations } from "next-intl";
import { BankIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/screen/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOpenFinanceScreen } from "../_hooks/use-pluggy-connection";
import { useOpenFinanceWorkspace } from "../_hooks/use-open-finance-workspace";
import { MappingForm } from "./mapping-form";
import { TransactionTable } from "./transaction-table";
import { BanksManagement } from "./banks-management";
import { SourceSummary } from "./source-summary";
import type { ViewProps } from "../_types/types";

export function OpenFinanceView({ overview: initialOverview }: ViewProps) {
  const t = useTranslations("scrn-open-finance");
  const { overview, connection } = useOpenFinanceScreen(initialOverview);
  const workspace = useOpenFinanceWorkspace(overview);
  const { source } = workspace;
  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} className="flex-col items-start sm:flex-row sm:items-center" right={
        <Button type="button" variant="outline" className="w-full sm:w-auto" aria-expanded={workspace.manageOpen} aria-controls="open-finance-banks" onClick={workspace.toggleManage}><BankIcon />{t(workspace.manageOpen ? "tabs.back" : "tabs.manage")}</Button>
      } />
      <BanksManagement overview={overview} connection={connection} open={workspace.manageOpen} onSelect={workspace.configure} />
      <Card>
        <CardHeader><CardTitle>{t("cards.source.title")}</CardTitle><CardDescription>{t("cards.source.description")}</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {workspace.sources.length > 0 ? <div className="flex flex-col gap-1.5">
            <label htmlFor="open-finance-source" className="text-sm font-medium">{t("fields.source.label")}</label>
            <Select value={source?.id ?? ""} onValueChange={workspace.select}><SelectTrigger id="open-finance-source" className="w-full"><SelectValue placeholder={t("fields.source.placeholder")} /></SelectTrigger><SelectContent>
              {workspace.sources.map((entry) => <SelectItem key={entry.id} value={entry.id}>{t("fields.source.option", { bank: entry.bankLabel, account: entry.name, type: t(entry.type === "CREDIT" ? "cards.source.credit" : "cards.source.bank") })}</SelectItem>)}
            </SelectContent></Select>
          </div> : <p className="text-sm text-muted-foreground">{t("cards.connections.description")}</p>}
          {source && workspace.ready && !workspace.editing && <SourceSummary source={source} accounts={overview.accounts} onEdit={workspace.edit} />}
          {source && workspace.editing && <MappingForm key={`${source.id}:${source.accountId}:${source.cardId}:${source.fromDate}`} source={source} accounts={overview.accounts} onReady={workspace.complete} onCancel={workspace.ready ? workspace.complete : undefined} />}
        </CardContent>
      </Card>
      {!source && <Empty><EmptyHeader><EmptyMedia variant="icon"><BankIcon /></EmptyMedia><EmptyTitle>{t("cards.source.empty")}</EmptyTitle><EmptyDescription>{t("cards.source.emptyDescription")}</EmptyDescription></EmptyHeader></Empty>}
      {source && workspace.ready && !workspace.editing && overview.configured && <Card>
        <CardHeader><CardTitle>{t("cards.review.title")}</CardTitle><CardDescription>{t("cards.review.description")}</CardDescription></CardHeader>
        <CardContent><TransactionTable key={`${source.id}:${source.accountId}:${source.cardId}:${source.fromDate}`} source={source} /></CardContent>
      </Card>}
    </div>
  );
}
