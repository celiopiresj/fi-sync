"use client";

import { useFormatter, useTranslations } from "next-intl";
import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import type { MonthSummaryProps } from "../_types/types";

export function MonthSummary({ summary }: MonthSummaryProps) {
  const t = useTranslations("scrn-open-finance");
  const formatter = useFormatter();
  return <KpiGrid columns={3} className="sm:grid-cols-3">
    <KpiCard label={t("cards.summary.income")} value={formatter.number(Number(summary.income), { style: "currency", currency: "BRL" })} tone="positive" />
    <KpiCard label={t("cards.summary.expense")} value={formatter.number(Number(summary.expense), { style: "currency", currency: "BRL" })} tone="negative" />
    <KpiCard label={t("cards.summary.count")} value={formatter.number(summary.count)} />
  </KpiGrid>;
}
