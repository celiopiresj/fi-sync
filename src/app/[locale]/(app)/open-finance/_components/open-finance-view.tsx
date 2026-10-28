"use client";

import { useTranslations } from "next-intl";
import { BankIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/screen/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { useOpenFinanceScreen } from "../_hooks/use-pluggy-connection";
import { useOpenFinanceWorkspace } from "../_hooks/use-open-finance-workspace";
import { MappingForm } from "./mapping-form";
import { TransactionTable } from "./transaction-table";
import { BanksManagement } from "./banks-management";
import { SourceSummary } from "./source-summary";
import { SourceSidebar } from "./source-sidebar";
import { ImportSteps } from "./import-steps";
import { ConnectMeuPluggy } from "./connect-meu-pluggy";
import type { ViewProps } from "../_types/types";

export function OpenFinanceView({ overview: initialOverview }: ViewProps) {
  const t = useTranslations("scrn-open-finance");
  const { overview, connection } = useOpenFinanceScreen(initialOverview);
  const workspace = useOpenFinanceWorkspace(overview);
  const { source } = workspace;
  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{t("breadcrumb.section")}</span><PageHeader title={t("title")} subtitle={t("subtitle")} className="flex-col items-start gap-4 xl:flex-row xl:items-end [&_h1]:text-[28px] [&_h1]:font-bold [&_h1]:tracking-tight" right={
        overview.configured ? <ConnectMeuPluggy connection={connection} /> : <p className="text-sm text-warning">{t("cards.setup.description")}</p>
      } />
      </div>
      <ImportSteps connected={workspace.sources.length > 0} selected={Boolean(source)} ready={workspace.ready && !workspace.editing} />
      <BanksManagement overview={overview} open={workspace.manageOpen} onSelect={workspace.configure} />
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <SourceSidebar overview={overview} sources={workspace.sources} source={source} onSelect={workspace.select} onManage={workspace.toggleManage} onConnect={connection.open} />
        <div className="flex min-w-0 flex-col gap-5">
        {source && <Card>
          <CardHeader><CardTitle>{t("cards.import.title", { source: source.name })}</CardTitle><CardDescription>{t("cards.import.description")}</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-4">
          {source && workspace.ready && !workspace.editing && <SourceSummary source={source} accounts={overview.accounts} onEdit={workspace.edit} />}
          {source && workspace.editing && <MappingForm key={`${source.id}:${source.accountId}:${source.cardId}:${source.fromDate}`} source={source} accounts={overview.accounts} onReady={workspace.complete} onCancel={workspace.ready ? workspace.complete : undefined} />}
          </CardContent>
        </Card>}
      {!source && <Card><CardContent className="py-10"><Empty><EmptyHeader><EmptyMedia variant="icon"><BankIcon /></EmptyMedia><EmptyTitle>{t("cards.source.empty")}</EmptyTitle><EmptyDescription>{t("cards.source.emptyDescription")}</EmptyDescription></EmptyHeader></Empty></CardContent></Card>}
      {source && workspace.ready && !workspace.editing && overview.configured && <Card>
        <CardContent className="px-0"><TransactionTable key={`${source.id}:${source.accountId}:${source.cardId}:${source.fromDate}`} source={source} /></CardContent>
      </Card>}
        </div>
      </div>
    </div>
  );
}
