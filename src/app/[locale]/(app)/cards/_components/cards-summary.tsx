"use client";

import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { getUsageTier } from "../_lib/card-usage";
import type { CardsSummary as CardsSummaryData } from "../_types/types";
import { CardUsageBar } from "./card-usage-bar";

type CardsSummaryProps = {
  summary: CardsSummaryData;
};

export function CardsSummary({ summary }: CardsSummaryProps) {
  const t = useTranslations("scrn-cards");
  const format = useFormatter();

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  return (
    <div className="flex w-full flex-col gap-4 rounded-lg bg-surface-1 p-4">
      <span className="text-xs text-muted-foreground">
        {t("sections.summary.title")}
      </span>

      {/* flex, not grid — a grid's 1fr columns stretch to fill this now
          full-width container, spreading the three stat blocks apart on
          a wide screen; flex sizes each block to its own content and
          keeps the whole group anchored to the left instead. Waits for
          `lg` (1024px), not `sm`, before going horizontal — three
          currency values need more room than transactions'/recurrences'
          own summary-cards.tsx multi-panel row does at that same
          breakpoint, so going horizontal any earlier would cramp them. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-10">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {t("sections.summary.totalLimit")}
          </span>
          <span className="text-lg font-medium tabular-nums">
            {money(summary.totalLimit)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {t("sections.summary.totalSpent")}
          </span>
          <span className="text-lg font-medium tabular-nums">
            {money(summary.totalSpent)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {t("sections.summary.totalAvailable")}
          </span>
          <span
            className={cn(
              "text-lg font-medium tabular-nums",
              summary.totalAvailable < 0 && "text-negative",
            )}
          >
            {money(summary.totalAvailable)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("sections.summary.overallUsage")}</span>
          <span className="tabular-nums">{summary.overallUsagePercent}%</span>
        </div>
        <CardUsageBar
          usagePercent={summary.overallUsagePercent}
          tier={getUsageTier(summary.overallUsagePercent)}
        />
      </div>
    </div>
  );
}
