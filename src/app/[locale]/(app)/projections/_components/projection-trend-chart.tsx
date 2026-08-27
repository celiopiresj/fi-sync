"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Area, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { TrendUpIcon } from "@phosphor-icons/react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { monthKeyToDate } from "../_lib/projection-month";
import type { ProjectionEntry } from "../_types/types";

type ProjectionTrendChartProps = {
  entries: ProjectionEntry[];
};

// The balance line stays green throughout, even where it dips negative
// (the light fill under it does the same) — the dashed red expenses
// line is what actually flags trouble: whenever it rides above the
// balance line, that month's commitments outpace the projected balance.
export function ProjectionTrendChart({ entries }: ProjectionTrendChartProps) {
  const t = useTranslations("scrn-projections");
  const format = useFormatter();

  const chartConfig = {
    projectedBalance: { label: t("chart.balanceLabel") },
    totalExpenses: { label: t("chart.expensesLabel") },
  } satisfies ChartConfig;

  const data = entries.map((entry) => ({
    ...entry,
    monthLabel: format.dateTime(monthKeyToDate(entry.monthKey), {
      month: "short",
      year: "numeric",
    }),
  }));

  function axisMoney(value: number) {
    return format.number(value, {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <TrendUpIcon className="size-4 text-positive" />
            {t("chart.title")}
          </span>
          <p className="text-xs text-muted-foreground">{t("chart.subtitle")}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-foreground">
            <span className="size-2 shrink-0 rounded-full bg-positive" />
            {t("chart.balanceLabel")}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-foreground">
            <span className="size-2 shrink-0 rounded-full bg-negative" />
            {t("chart.expensesLabel")}
          </span>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-64 w-full">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <ReferenceLine y={0} stroke="var(--border)" />
          <XAxis
            dataKey="monthLabel"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            className="capitalize"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={axisMoney}
            width={72}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {name === "projectedBalance"
                        ? t("chart.balanceLabel")
                        : t("chart.expensesLabel")}
                    </span>
                    <span className="font-mono font-medium tabular-nums">
                      {format.number(Number(value), {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Area
            dataKey="projectedBalance"
            stroke="var(--positive)"
            fill="var(--positive)"
            fillOpacity={0.12}
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--positive)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          <Line
            dataKey="totalExpenses"
            stroke="var(--negative)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 4, fill: "var(--background)", stroke: "var(--negative)", strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}
