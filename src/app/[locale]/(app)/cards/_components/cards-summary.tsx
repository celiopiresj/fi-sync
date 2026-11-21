"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getUsageTier } from "../_lib/card-usage";
import { useCardMoney } from "../_hooks/use-card-money";
import type { CardsSummary as CardsSummaryData } from "../_types/types";
import { CardUsageBar } from "./card-usage-bar";

type CardsSummaryProps = {
  summary: CardsSummaryData;
};

export function CardsSummary({ summary }: CardsSummaryProps) {
  const t = useTranslations("scrn-cards");
  const money = useCardMoney();

  return (
    <Card className="@container">
      <CardContent className="flex flex-col gap-4">
        <span className="font-heading text-sm font-semibold text-foreground">
          {t("sections.summary.title")}
        </span>

        {/* Verdict-First: available limit leads as the headline figure,
            paired with total spent and total limit beside it on wider
            containers. */}
        <div className="flex flex-col gap-4 @2xl:flex-row @2xl:items-end @2xl:gap-10">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              {t("sections.summary.totalAvailable")}
            </span>
            <span
              className={cn(
                "font-heading text-3xl font-bold tracking-tight tabular-nums",
                summary.totalAvailable < 0 ? "text-negative" : "text-foreground",
              )}
            >
              {money(summary.totalAvailable)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-3 @2xl:flex @2xl:gap-8 @2xl:border-t-0 @2xl:border-l @2xl:pt-0 @2xl:pl-8">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                {t("sections.summary.totalSpent")}
              </span>
              <span className="font-heading text-lg font-semibold tracking-tight tabular-nums">
                {money(summary.totalSpent)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                {t("sections.summary.totalLimit")}
              </span>
              <span className="font-heading text-lg font-semibold tracking-tight tabular-nums">
                {money(summary.totalLimit)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("sections.summary.overallUsage")}</span>
            <span className="font-medium tabular-nums">
              {summary.overallUsagePercent}%
            </span>
          </div>
          <CardUsageBar
            usagePercent={summary.overallUsagePercent}
            tier={getUsageTier(summary.overallUsagePercent)}
            label={t("sections.summary.overallUsage")}
          />
        </div>
      </CardContent>
    </Card>
  );
}
