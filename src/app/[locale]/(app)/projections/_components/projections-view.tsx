"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { PageHeader } from "@/components/screen/page-header";
import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import { ViewModeToggle, type ViewMode } from "@/components/screen/view-mode-toggle";
import { monthKeyToDate } from "../_lib/projection-month";
import { useProjectionsData } from "../_hooks/use-projections-data";
import {
  DEFAULT_MONTHS_AHEAD,
  type MonthsAheadOption,
} from "../_constants/constants";
import { ProjectionPeriodToggle } from "./projection-period-toggle";
import { ProjectionTrendChart } from "./projection-trend-chart";
import { ProjectionCard } from "./projection-card";
import { ProjectionList } from "./projection-list";
import type { ProjectionEntry } from "../_types/types";

type ProjectionsViewProps = {
  initialProjections: ProjectionEntry[];
};

export function ProjectionsView({ initialProjections }: ProjectionsViewProps) {
  const t = useTranslations("scrn-projections");
  const format = useFormatter();

  const [monthsAhead, setMonthsAhead] = useState<MonthsAheadOption>(
    DEFAULT_MONTHS_AHEAD,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const { projections } = useProjectionsData(
    monthsAhead,
    initialProjections,
    monthsAhead === DEFAULT_MONTHS_AHEAD,
  );

  // The 4 executive KPIs (redesign spec section 4.1) — all plain reduces
  // over the already-fetched, already-period-scoped array, so switching
  // the period selector recomputes them for free instead of needing a
  // separate summary endpoint.
  const kpis = useMemo(() => {
    const currentBalance = projections[0]?.initialBalance ?? 0;
    const lowest = projections.reduce<ProjectionEntry | null>(
      (min, entry) =>
        !min || entry.projectedBalance < min.projectedBalance ? entry : min,
      null,
    );
    const totalFutureCards = projections.reduce(
      (sum, entry) => sum + entry.cardExpenses,
      0,
    );
    const totalIncome = projections.reduce(
      (sum, entry) => sum + entry.incomeForecast,
      0,
    );
    return { currentBalance, lowest, totalFutureCards, totalIncome };
  }, [projections]);

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { count: monthsAhead })}
        right={
          <ProjectionPeriodToggle value={monthsAhead} onValueChange={setMonthsAhead} />
        }
      />

      <KpiGrid columns={4}>
        <KpiCard
          label={t("kpi.currentBalance")}
          value={money(kpis.currentBalance)}
        />
        <KpiCard
          label={t("kpi.lowestPoint")}
          value={kpis.lowest ? money(kpis.lowest.projectedBalance) : money(0)}
          subtitle={
            kpis.lowest
              ? format.dateTime(monthKeyToDate(kpis.lowest.monthKey), {
                  month: "long",
                  year: "numeric",
                })
              : undefined
          }
          tone={kpis.lowest && kpis.lowest.projectedBalance < 0 ? "negative" : "default"}
        />
        <KpiCard
          label={t("kpi.futureCardCommitment")}
          value={money(kpis.totalFutureCards)}
          tone="warning"
        />
        <KpiCard
          label={t("kpi.expectedIncome")}
          value={money(kpis.totalIncome)}
          tone="positive"
        />
      </KpiGrid>

      <ProjectionTrendChart entries={projections} />

      <div className="flex items-center justify-end">
        <ViewModeToggle
          value={viewMode}
          onValueChange={setViewMode}
          cardsLabel={t("viewMode.cards")}
          listLabel={t("viewMode.list")}
        />
      </div>

      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projections.map((entry) => (
            <ProjectionCard key={entry.monthKey} entry={entry} />
          ))}
        </div>
      ) : (
        <>
          {/* ProjectionList's <Table> doesn't reflow well below
              `min-[700px]` (same limitation as transactions'/
              recurrences' own DataTable) — ProjectionCard already covers
              every field the table's columns show, so it's reused as the
              narrow-screen fallback instead of a dedicated mobile-list
              component. */}
          <div className="hidden min-[700px]:block">
            <ProjectionList entries={projections} />
          </div>
          <div className="grid grid-cols-1 gap-4 min-[700px]:hidden">
            {projections.map((entry) => (
              <ProjectionCard key={entry.monthKey} entry={entry} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
