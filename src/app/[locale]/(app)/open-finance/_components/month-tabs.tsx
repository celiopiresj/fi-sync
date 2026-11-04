"use client";

import { useFormatter, useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { capitalizeFirst } from "@/lib/capitalize-first";
import { cn } from "@/lib/utils";
import { monthLabelParts } from "../_lib/month-label";
import type { MonthTabsProps } from "../_types/types";

export function MonthTabs({ months, value, onChange }: MonthTabsProps) {
  const t = useTranslations("scrn-open-finance");
  const formatter = useFormatter();
  return <div className="overflow-x-auto border-b px-5 py-3">
    <ToggleGroup type="single" variant="tabs" value={value} onValueChange={onChange} aria-label={t("tabs.months.label")} className="w-max">
      {months.map((entry) => {
        const label = monthLabelParts(entry.month);
        return <ToggleGroupItem key={entry.month} value={entry.month} className="h-auto flex-col items-start gap-0.5 px-3 py-1.5">
          <span className="text-sm font-semibold">{capitalizeFirst(formatter.dateTime(label.date, label.options))}</span>
          <span className={cn("text-xs font-normal text-muted-foreground tabular-nums", entry.count === 0 && "text-positive", entry.month === value && entry.count !== 0 && "text-primary")}>
            {entry.count === null ? t("tabs.months.unknown") : entry.more ? t("tabs.months.more", { count: entry.count }) : t("tabs.months.pending", { count: entry.count })}
          </span>
        </ToggleGroupItem>;
      })}
    </ToggleGroup>
  </div>;
}
