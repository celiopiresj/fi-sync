"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { parseCalendarDate } from "@/lib/date";
import { sourceDestination } from "../_lib/options";
import { SourcePicker } from "./source-picker";
import type { SourceSummaryProps } from "../_types/types";

// Source picker plus where it saves. The destination details and the edit
// link only show once the source is ready (`onEdit`); while the mapping is
// being edited the form below already shows them.
export function SourceSummary({ source, sources, accounts, onSelect, onEdit }: SourceSummaryProps) {
  const t = useTranslations("scrn-open-finance");
  const formatter = useFormatter();
  const { account, card } = sourceDestination(source, accounts);
  return <div className="flex flex-col gap-3 border-b bg-muted/50 px-5 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4.5">
    <SourcePicker sources={sources} source={source} accounts={accounts} onSelect={onSelect} />
    {onEdit && <>
      <div className="flex min-w-0 flex-col gap-0.5 text-xs text-muted-foreground">
        <span className="wrap-break-word">{t.rich("cards.mapping.saving", { account: account?.name ?? t("cards.mapping.unmapped"), b: (chunks) => <b className="font-semibold text-foreground">{chunks}</b> })}</span>
        <span className="flex flex-wrap gap-x-4 gap-y-0.5">
          {card && <span>{t("cards.mapping.card", { card: card.name })}</span>}
          {source.fromDate && <span>{t("cards.mapping.from", { date: formatter.dateTime(parseCalendarDate(source.fromDate), { dateStyle: "short" }) })}</span>}
        </span>
      </div>
      <Button type="button" variant="link" size="sm" className="self-start px-0 sm:ml-auto sm:self-auto" onClick={onEdit}>{t("cards.mapping.edit")}</Button>
    </>}
  </div>;
}
