"use client";

import { useFormatter, useTranslations } from "next-intl";
import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import { formatMoney, formatMonthLong } from "../_lib/format-payoff";
import type { CardPayoff } from "../_types/types";

type PayoffKpisProps = {
  payoff: CardPayoff;
  // Set while the screen is filtered to exactly one person — the total
  // is then theirs alone, so the "sua parte"/"outras pessoas" split is
  // dropped.
  singlePersonName: string | null;
  // How many people the filter picked (0 = everyone).
  selectedCount: number;
};

export function PayoffKpis({ payoff, singlePersonName, selectedCount }: PayoffKpisProps) {
  const t = useTranslations("scrn-card-payoff");
  const format = useFormatter();

  return (
    <KpiGrid columns={singlePersonName === null ? 4 : 2}>
      <KpiCard
        label={
          singlePersonName !== null
            ? t("kpis.totalPerson", { name: singlePersonName })
            : selectedCount > 0
              ? t("kpis.totalSelected", { count: selectedCount })
              : t("kpis.total")
        }
        value={formatMoney(format, payoff.total)}
        tone="negative"
        subtitle={t("kpis.totalLegend", { count: payoff.purchasesCount })}
      />
      {singlePersonName === null && (
        <>
          <KpiCard
            label={t("kpis.self")}
            value={formatMoney(format, payoff.selfTotal)}
            subtitle={t("kpis.selfLegend")}
          />
          <KpiCard
            label={t("kpis.others")}
            value={formatMoney(format, payoff.othersTotal)}
            subtitle={t("kpis.othersLegend", { count: payoff.othersCount })}
          />
        </>
      )}
      <KpiCard
        label={t("kpis.parcels")}
        value={payoff.parcelsCount}
        subtitle={
          payoff.lastParcelMonth
            ? t("kpis.parcelsLegend", {
                month: formatMonthLong(format, payoff.lastParcelMonth),
              })
            : t("kpis.parcelsNone")
        }
      />
    </KpiGrid>
  );
}
