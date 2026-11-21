"use client";

import { useFormatter, useTranslations } from "next-intl";
import { ArrowDownLeftIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { SectionCard } from "@/components/screen/section-card";
import { cn } from "@/lib/utils";
import { useHomeMoney } from "../_hooks/use-home-money";
import { TONE_BAR } from "../_constants/constants";
import {
  shareBarWidth,
  spentShareOfIncome,
  spentShareTone,
} from "../_lib/overview-money";
import { MonthFlowTile } from "./month-flow-tile";
import type { HomeOverview } from "../_types/types";

type MonthSummaryProps = {
  overview: HomeOverview;
  visible: boolean;
};

export function MonthSummary({ overview, visible }: MonthSummaryProps) {
  const t = useTranslations("scrn-home");
  const format = useFormatter();
  const money = useHomeMoney(visible);
  const net = overview.netChangeThisMonth;
  const share = spentShareOfIncome(overview.monthIncome, overview.monthExpenses);
  const tone = spentShareTone(share);

  return (
    <SectionCard
      title={t("monthSummary.title")}
      action={
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            net >= 0 ? "text-positive" : "text-negative",
          )}
        >
          {t("monthSummary.net", { value: money(net, { signed: true }) })}
        </span>
      }
      contentClassName="gap-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <MonthFlowTile
          tone="positive"
          icon={<ArrowDownLeftIcon className="size-3.5" />}
          label={t("monthSummary.income")}
          value={money(overview.monthIncome)}
        />
        <MonthFlowTile
          tone="negative"
          icon={<ArrowUpRightIcon className="size-3.5" />}
          label={t("monthSummary.expenses")}
          value={money(overview.monthExpenses)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", TONE_BAR[tone])}
            style={{ width: shareBarWidth(share) }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {share === null
            ? t("monthSummary.noIncome")
            : t("monthSummary.spentShare", {
                percent: format.number(share, { style: "percent", maximumFractionDigits: 0 }),
              })}
        </span>
      </div>
    </SectionCard>
  );
}
