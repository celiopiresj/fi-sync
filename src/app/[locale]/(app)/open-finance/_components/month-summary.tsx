"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { MonthSummaryProps } from "../_types/types";

// A three-cell strip inside the import panel (not a row of separate stat
// cards): it summarizes the month tab right above it.
export function MonthSummary({ summary }: MonthSummaryProps) {
  const t = useTranslations("scrn-open-finance");
  const formatter = useFormatter();
  return <dl className="grid grid-cols-3 gap-px border-b bg-border">
    <div className="flex min-w-0 flex-col gap-1 bg-card px-3.5 py-3 sm:px-5 sm:py-3.5"><dt className="text-xs text-muted-foreground">{t("cards.summary.income")}</dt><dd className="truncate text-base font-semibold text-positive tabular-nums sm:text-lg">{formatter.number(Number(summary.income), { style: "currency", currency: "BRL" })}</dd></div>
    <div className="flex min-w-0 flex-col gap-1 bg-card px-3.5 py-3 sm:px-5 sm:py-3.5"><dt className="text-xs text-muted-foreground">{t("cards.summary.expense")}</dt><dd className="truncate text-base font-semibold text-negative tabular-nums sm:text-lg">{formatter.number(Number(summary.expense), { style: "currency", currency: "BRL" })}</dd></div>
    <div className="flex min-w-0 flex-col gap-1 bg-card px-3.5 py-3 sm:px-5 sm:py-3.5"><dt className="text-xs text-muted-foreground">{t("cards.summary.count")}</dt><dd className="truncate text-base font-semibold tabular-nums sm:text-lg">{formatter.number(summary.count)}</dd></div>
  </dl>;
}
