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
  return <div className="flex flex-col gap-2 border-b bg-muted/50 px-5 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium">
      <span className="sr-only">{t("cards.mapping.title")}</span>
      <span className="wrap-break-word">{source.name}</span><ArrowRightIcon className="shrink-0 text-muted-foreground" aria-hidden="true" /><span className="wrap-break-word">{account?.name ?? t("cards.mapping.unmapped")}</span>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {card && <span>{t("cards.mapping.card", { card: card.name })}</span>}
      {source.fromDate && <span>{t("cards.mapping.from", { date: formatter.dateTime(parseCalendarDate(source.fromDate), { dateStyle: "short" }) })}</span>}
    </div>
    <Button type="button" variant="link" size="sm" className="self-start px-0 sm:ml-auto sm:self-auto" onClick={onEdit}>{t("cards.mapping.edit")}</Button>
  </div>;
}
