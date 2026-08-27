"use client";

import { useFormatter, useTranslations } from "next-intl";
import { ArrowRightIcon, CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { monthKeyToDate } from "../_lib/projection-month";
import { RISK_BADGE_CLASS, RISK_TEXT_CLASS } from "../_lib/risk-status-style";
import type { ProjectionEntry } from "../_types/types";

type ProjectionCardProps = {
  entry: ProjectionEntry;
};

export function ProjectionCard({ entry }: ProjectionCardProps) {
  const t = useTranslations("scrn-projections");
  const format = useFormatter();

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  const monthLabel = format.dateTime(monthKeyToDate(entry.monthKey), {
    month: "short",
    year: "2-digit",
  });

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold capitalize">{monthLabel}</span>
        {entry.isCurrentMonth && (
          <Badge variant="secondary">{t("card.currentMonthBadge")}</Badge>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          {t("card.projectedBalance")}
        </span>
        <div className="flex items-center gap-1.5">
          {entry.status !== "ok" && (
            <WarningCircleIcon
              className={cn("size-4 shrink-0", RISK_TEXT_CLASS[entry.status])}
            />
          )}
          <span
            className={cn(
              "text-xl font-semibold tabular-nums",
              RISK_TEXT_CLASS[entry.status],
            )}
          >
            {money(entry.projectedBalance)}
          </span>
        </div>
        <Badge variant="outline" className={cn("w-fit", RISK_BADGE_CLASS[entry.status])}>
          {entry.status === "ok" ? (
            <CheckCircleIcon />
          ) : (
            <WarningCircleIcon />
          )}
          {t(`status.${entry.status}`)}
        </Badge>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("card.cardExpenses")}</span>
          <span className="tabular-nums">{money(entry.cardExpenses)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">
            {t("card.accountExpenses")}
          </span>
          <span className="tabular-nums">{money(entry.accountExpenses)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 font-medium">
          <span>{t("card.totalExpenses")}</span>
          <span className="tabular-nums text-negative">
            {money(entry.totalExpenses)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">
            {t("card.incomeForecast")}
          </span>
          <span className="tabular-nums text-positive">
            {money(entry.incomeForecast)}
          </span>
        </div>
      </div>

      <Link
        href={`/projections/${entry.monthKey}`}
        className="mt-1 inline-flex items-center gap-1 self-end text-xs font-medium text-primary hover:underline"
      >
        {t("card.viewDetail")}
        <ArrowRightIcon className="size-3" />
      </Link>
    </div>
  );
}
