"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { HomeOverview } from "../_types/types";

// Fixed pt-BR formatters, matching the chart's month labels — same
// "chart isn't locale-dependent" convention as transactions/_components/
// table/monthly-balance-chart.tsx.
const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const compactMoneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 0,
});
// Phone-width axis ticks drop the currency symbol ("8 mil" instead of
// "R$ 8 mil"): the same tick is ~40% narrower, which is what lets the
// Y axis give ~20px of a ~280px card back to the bars. Nothing is lost
// by it — the legend right above already reads "Receitas (R$)" and the
// tooltip still formats full currency.
const compactNumberFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 0,
});

type Range = "6" | "12";

type HomeBalanceChartProps = {
  monthlyTrend: HomeOverview["monthlyTrend"];
};

export function HomeBalanceChart({ monthlyTrend }: HomeBalanceChartProps) {
  const t = useTranslations("scrn-home");
  const isMobile = useIsMobile();
  const [range, setRange] = useState<Range>("6");

  // monthlyTrend already covers the full 12-month window server-side —
  // switching ranges is just a client-side slice, no refetch.
  const data = range === "6" ? monthlyTrend.slice(-6) : monthlyTrend;

  const chartConfig = {
    income: { label: t("chart.income") },
    expenses: { label: t("chart.expenses") },
  } satisfies ChartConfig;

  if (data.every((month) => month.income === 0 && month.expenses === 0)) {
    return <p className="text-xs text-muted-foreground">{t("chart.empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Wraps instead of squeezing: at phone width the legend and the
          range toggle don't fit on one line, and `justify-between` alone
          was compressing the legend until "Receitas (R$)" broke across
          two lines mid-label. Wrapping drops the toggle to its own row
          and `whitespace-nowrap` keeps each label in one piece. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="size-2 shrink-0 rounded-full bg-positive" />
            {t("chart.income")}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="size-2 shrink-0 rounded-full bg-negative" />
            {t("chart.expenses")}
          </span>
        </div>
        <ToggleGroup
          type="single"
          variant="tabs"
          size="sm"
          value={range}
          onValueChange={(value) => {
            if (value) setRange(value as Range);
          }}
        >
          <ToggleGroupItem value="6">{t("chart.range6")}</ToggleGroupItem>
          <ToggleGroupItem value="12">{t("chart.range12")}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <ChartContainer config={chartConfig} className="h-64 w-full">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <ReferenceLine y={0} stroke="var(--border)" />
          <XAxis
            dataKey="monthLabel"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            // 12 months of labels collide on a phone. `undefined` on
            // desktop leaves Recharts' own default in place rather than
            // changing the wide layout too.
            interval={isMobile ? "preserveStartEnd" : undefined}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={isMobile ? 38 : 56}
            tick={{ fontSize: 10 }}
            tickFormatter={(value: number) =>
              (isMobile ? compactNumberFormatter : compactMoneyFormatter).format(
                value,
              )
            }
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {name === "income" ? t("chart.income") : t("chart.expenses")}
                    </span>
                    <span className="font-mono font-medium tabular-nums">
                      {moneyFormatter.format(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="income" fill="var(--positive)" radius={4} />
          <Bar dataKey="expenses" fill="var(--negative)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
