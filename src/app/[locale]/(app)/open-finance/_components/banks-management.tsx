"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BankIcon, CreditCardIcon, PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useOpenFinanceMutations } from "../_hooks/use-open-finance";
import { groupSources, sourceDestination } from "../_lib/options";
import { ConnectionForm } from "./connection-form";
import type { BanksManagementProps } from "../_types/types";

export function BanksManagement({ overview, open, onOpenChange, onSelect, onConnect }: BanksManagementProps) {
  const t = useTranslations("scrn-open-finance");
  const { disable } = useOpenFinanceMutations();
  const [showInactive, setShowInactive] = useState(false);
  const [manual, setManual] = useState(false);
  const active = overview.connections.filter((entry) => entry.active);
  const inactive = overview.connections.filter((entry) => !entry.active);
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" closeLabel={t("aria.manageClose")} className="overflow-y-auto data-[side=right]:sm:max-w-xl">
      <SheetHeader className="pr-12">
        <SheetTitle>{t("cards.management.title")}</SheetTitle>
        <SheetDescription>{t("cards.management.description")}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-4 pb-6">
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">{t("cards.sidebar.capacity", { count: active.length })}</span>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={Math.min(active.length, 5)} aria-label={t("cards.sidebar.capacity", { count: active.length })} className="flex gap-1">{Array.from({ length: 5 }, (_, index) => <span key={index} className={cn("h-1.5 flex-1 rounded-full bg-muted", index < active.length && "bg-primary")} />)}</div>
        </div>
        {!overview.configured && <p className="text-sm text-warning">{t("cards.setup.description")}</p>}
        {active.map((entry) => <div key={entry.id} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium wrap-break-word">{entry.label}</h3><Button type="button" size="sm" variant="ghost" className="text-negative" disabled={disable.isPending} onClick={() => disable.mutate(entry.id)}>{t("buttons.disable")}</Button></div>
          {groupSources(entry.sources).filter((group) => group.sources.length > 0).map((group) => <section key={group.type} className="flex flex-col gap-3 border-t pt-3"><h4 className="text-xs font-semibold text-muted-foreground">{t(`cards.sidebar.${group.title}`)}</h4>{group.sources.map((source) => <div key={source.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              {source.type === "CREDIT" ? <CreditCardIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" /> : <BankIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
              <div className="flex min-w-0 flex-col gap-1 text-sm"><span className="wrap-break-word">{source.name}</span><span className="text-xs text-muted-foreground">{t(source.type === "CREDIT" ? "cards.source.credit" : "cards.source.bank")}</span><span className="wrap-break-word text-xs text-muted-foreground">{t("cards.mapping.route", { source: source.name, account: sourceDestination(source, overview.accounts).account?.name ?? t("cards.mapping.unmapped") })}</span></div>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => onSelect(source.id)}>{t(source.accountId ? "cards.management.change" : "cards.management.configure")}</Button>
          </div>)}</section>)}
        </div>)}
        <Button type="button" variant="outline" className="border-dashed text-primary" disabled={!overview.configured} onClick={onConnect}><PlusIcon />{t("cards.sidebar.add")}</Button>
        {inactive.length > 0 && <div className="flex flex-col gap-3 border-t pt-3">
          <Button type="button" variant="ghost" className="self-start" aria-expanded={showInactive} onClick={() => setShowInactive((show) => !show)}>{showInactive ? t("cards.management.hideInactive") : t("cards.management.inactive", { count: inactive.length })}</Button>
          {showInactive && inactive.map((entry) => <div key={entry.id} className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground"><span className="wrap-break-word">{entry.label}</span><span>{t("cards.connections.inactive")}</span></div>)}
        </div>}
        <div className="flex flex-col gap-3 border-t pt-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" aria-expanded={manual} onClick={() => setManual((value) => !value)}>{t("cards.connect.manual")}</Button>
            <Button type="button" variant="ghost" size="sm" asChild><a href="https://docs.pluggy.ai/pt/docs/guides/meu-pluggy-personal-use" target="_blank" rel="noopener noreferrer">{t("buttons.guide")}</a></Button>
          </div>
          {manual && <ConnectionForm />}
        </div>
      </div>
    </SheetContent>
  </Sheet>;
}
