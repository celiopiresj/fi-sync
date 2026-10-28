"use client";

import { useFormatter, useTranslations } from "next-intl";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { parseCalendarDate } from "@/lib/date";
import { sourceDestination } from "../_lib/options";
import type { SourceSummaryProps } from "../_types/types";

export function SourceSummary({ source, accounts, onEdit }: SourceSummaryProps) {
  const t = useTranslations("scrn-open-finance");
  const formatter = useFormatter();
  const { account, card } = sourceDestination(source, accounts);
  return <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{t("cards.mapping.title")}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium">
        <span className="wrap-break-word">{source.name}</span><ArrowRightIcon className="shrink-0 text-muted-foreground" aria-hidden="true" /><span className="wrap-break-word">{account?.name ?? t("cards.mapping.unmapped")}</span>
      </div>
      {card && <span className="text-xs text-muted-foreground">{t("cards.mapping.card", { card: card.name })}</span>}
      {source.fromDate && <span className="text-xs text-muted-foreground">{t("cards.mapping.from", { date: formatter.dateTime(parseCalendarDate(source.fromDate), { dateStyle: "short" }) })}</span>}
    </div>
    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onEdit}>{t("cards.mapping.edit")}</Button>
  </div>;
}
