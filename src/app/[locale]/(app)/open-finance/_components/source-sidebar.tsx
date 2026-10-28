"use client";

import { useTranslations } from "next-intl";
import { BankIcon, CreditCardIcon, PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { groupSources, sourceDestination } from "../_lib/options";
import { useOpenFinanceMutations } from "../_hooks/use-open-finance";
import type { SourceSidebarProps } from "../_types/types";

export function SourceSidebar({ overview, sources, source, onSelect, onManage, onConnect }: SourceSidebarProps) {
  const t = useTranslations("scrn-open-finance");
  const { disable } = useOpenFinanceMutations();
  const count = overview.connections.filter((connection) => connection.active).length;
  return <Card className="h-fit py-5">
    <CardHeader className="gap-3 px-5"><div className="flex items-center justify-between"><CardTitle>{t("cards.sidebar.title")}</CardTitle><span className="text-xs text-muted-foreground">{t("cards.sidebar.capacity", { count })}</span></div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={Math.min(count, 5)} aria-label={t("cards.sidebar.capacity", { count })} className="flex gap-1">{Array.from({ length: 5 }, (_, index) => <span key={index} className={cn("h-1.5 flex-1 rounded-full bg-muted", index < count && "bg-primary")} />)}</div>
      <p className="text-xs/relaxed text-muted-foreground">{t("cards.sidebar.description")}</p>
    </CardHeader>
    <CardContent className="flex flex-col gap-5 px-5">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">{groupSources(sources).map((group) => <section key={group.type} aria-labelledby={`open-finance-${group.type}`} className="flex min-w-0 flex-col gap-2.5">
        <h2 id={`open-finance-${group.type}`} className="flex items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground"><span>{t(`cards.sidebar.${group.title}`)}</span><span>{group.sources.length}</span></h2>
        {group.sources.length === 0 && <p className="py-2 text-xs text-muted-foreground">{t(`cards.sidebar.${group.empty}`)}</p>}
        {group.sources.map((entry) => <Button key={entry.id} type="button" variant="outline" aria-pressed={source?.id === entry.id} className={cn("h-auto w-full justify-start gap-3 whitespace-normal rounded-lg p-3 text-left", source?.id === entry.id && "border-primary bg-primary/5 ring-2 ring-primary/10")} onClick={() => onSelect(entry.id)}>
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground", source?.id === entry.id && "bg-primary/10 text-primary")}>{group.type === "CREDIT" ? <CreditCardIcon className="size-5" /> : <BankIcon className="size-5" />}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-1"><span className="text-sm font-semibold wrap-break-word">{entry.name}</span><span className="text-xs font-normal text-muted-foreground wrap-break-word">{entry.bankLabel}</span><span className="text-xs font-normal text-positive">{t("cards.sidebar.active")}</span></span>
        </Button>)}
      </section>)}</div>
      {source && <div className="flex flex-col gap-3 border-t pt-4 text-xs">
        <h2 className="font-semibold tracking-wide text-muted-foreground">{t("cards.sidebar.selected")}</h2>
        <div className="flex flex-wrap justify-between gap-2"><span className="text-muted-foreground">{t("cards.mapping.title")}</span><span className="font-medium">{sourceDestination(source, overview.accounts).account?.name ?? t("cards.mapping.unmapped")}</span></div>
        <div className="flex flex-wrap justify-between gap-2"><span className="text-muted-foreground">{t("cards.sidebar.cadenceLabel")}</span><span>{t("cards.sidebar.cadence")}</span></div>
        <Button type="button" variant="ghost" size="sm" className="self-start text-negative" disabled={disable.isPending} onClick={() => disable.mutate(source.connectionId)}>{t("buttons.disable")}</Button>
      </div>}
      <div className="flex flex-col gap-2 border-t pt-4"><Button type="button" variant="outline" className="border-dashed text-primary" disabled={!overview.configured} onClick={onConnect}><PlusIcon />{t("cards.sidebar.add")}</Button><Button type="button" variant="ghost" size="sm" onClick={onManage}>{t("tabs.manage")}</Button></div>
    </CardContent>
  </Card>;
}
