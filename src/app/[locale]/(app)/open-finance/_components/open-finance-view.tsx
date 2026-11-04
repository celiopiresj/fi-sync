"use client";

import { useTranslations } from "next-intl";
import { BankIcon, GearSixIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/screen/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia, EmptyContent } from "@/components/ui/empty";
import { useOpenFinanceScreen } from "../_hooks/use-pluggy-connection";
import { useOpenFinanceWorkspace } from "../_hooks/use-open-finance-workspace";
import { MappingForm } from "./mapping-form";
import { TransactionTable } from "./transaction-table";
import { BanksManagement } from "./banks-management";
import { SourceSummary } from "./source-summary";
import { SourceStrip } from "./source-strip";
import { ImportSteps } from "./import-steps";
import { ConnectMeuPluggy } from "./connect-meu-pluggy";
import type { ViewProps } from "../_types/types";

export function OpenFinanceView({ overview: initialOverview }: ViewProps) {
  const t = useTranslations("scrn-open-finance");
  const { overview, connection } = useOpenFinanceScreen(initialOverview);
  const workspace = useOpenFinanceWorkspace(overview);
  const { source } = workspace;
  const sourceKey = source ? `${source.id}:${source.accountId}:${source.cardId}:${source.fromDate}` : "";
  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{t("breadcrumb.section")}</span><PageHeader title={t("title")} subtitle={t("subtitle")} className="flex-col items-start gap-4 xl:flex-row xl:items-end [&_h1]:text-[28px] [&_h1]:font-bold [&_h1]:tracking-tight" right={
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-start xl:w-auto xl:justify-end">
          <Button type="button" variant="outline" onClick={() => workspace.setManageOpen(true)}><GearSixIcon />{t("tabs.manage")}</Button>
          {overview.configured ? <ConnectMeuPluggy connection={connection} /> : <p className="text-sm text-warning">{t("cards.setup.description")}</p>}
        </div>
      } />
      </div>
      {!workspace.setupComplete && <ImportSteps connected={workspace.sources.length > 0} selected={Boolean(source)} ready={workspace.setupComplete} />}
      <BanksManagement overview={overview} open={workspace.manageOpen} onOpenChange={workspace.setManageOpen} onSelect={workspace.configure} onConnect={() => { workspace.setManageOpen(false); connection.open(); }} />
      {workspace.sources.length > 0 && <SourceStrip sources={workspace.sources} source={source} onSelect={workspace.select} />}

      {!source && <Card><CardContent className="py-10"><Empty><EmptyHeader><EmptyMedia variant="icon"><BankIcon /></EmptyMedia><EmptyTitle>{workspace.sources.length > 0 ? t("cards.source.empty") : t("cards.connections.empty")}</EmptyTitle><EmptyDescription>{workspace.sources.length > 0 ? t("cards.source.emptyDescription") : t("cards.connections.description")}</EmptyDescription></EmptyHeader>
        {workspace.sources.length === 0 && <EmptyContent><Button type="button" variant="outline" onClick={() => workspace.setManageOpen(true)}><GearSixIcon />{t("tabs.manage")}</Button></EmptyContent>}
      </Empty></CardContent></Card>}

      {source && workspace.editing && <Card>
        <CardHeader><CardTitle>{t("cards.import.title", { source: source.name })}</CardTitle><CardDescription>{t("cards.import.description")}</CardDescription></CardHeader>
        <CardContent><MappingForm key={sourceKey} source={source} accounts={overview.accounts} onReady={workspace.complete} onCancel={workspace.ready ? workspace.complete : undefined} /></CardContent>
      </Card>}

      {source && workspace.setupComplete && overview.configured && <TransactionTable key={sourceKey} source={source} header={<SourceSummary source={source} accounts={overview.accounts} onEdit={workspace.edit} />} accounts={overview.accounts} categories={overview.categories} people={overview.people} defaultPersonId={overview.defaultPersonId} />}
      {source && workspace.setupComplete && !overview.configured && <Card><SourceSummary source={source} accounts={overview.accounts} onEdit={workspace.edit} /></Card>}
    </div>
  );
}
