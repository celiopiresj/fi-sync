"use client";

import { useFormatter, useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { capitalizeFirst } from "@/lib/capitalize-first";
import { cn } from "@/lib/utils";
import { monthLabelParts } from "../_lib/month-label";
import type { MonthTabsProps } from "../_types/types";

// Underlined tabs: the selected month gets the primary underline and its
// pending count in the primary color; fully imported months read positive.
export function MonthTabs({ months, value, onChange }: MonthTabsProps) {
  const t = useTranslations("scrn-open-finance");
  const formatter = useFormatter();
  return <div className="overflow-x-auto border-b px-5 pt-3">
    <ToggleGroup type="single" spacing={1} value={value} onValueChange={onChange} aria-label={t("tabs.months.label")} className="w-max">
      {months.map((entry) => {
        const label = monthLabelParts(entry.month);
        const name = capitalizeFirst(formatter.dateTime(label.date, label.options));
        const selected = entry.month === value;
        return <ToggleGroupItem key={entry.month} value={entry.month} className="-mb-px h-auto flex-col items-start gap-0.5 rounded-none border-b-2 border-transparent px-3.5 pt-2 pb-2.5 text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:bg-transparent data-[state=on]:border-primary data-[state=on]:bg-transparent data-[state=on]:text-foreground">
          <span className="text-sm font-semibold">{label.future ? t("tabs.months.future", { month: name }) : name}</span>
          <span className={cn("text-xs font-normal tabular-nums", entry.count === 0 && "text-positive", selected && entry.count !== 0 && "font-semibold text-primary")}>
            {entry.count === null ? t("tabs.months.unknown") : entry.more ? t("tabs.months.more", { count: entry.count }) : t("tabs.months.pending", { count: entry.count })}
          </span>
        </ToggleGroupItem>;
      })}
    </ToggleGroup>
  </div>;
}
