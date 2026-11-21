"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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

// Income and expenses side by side for each month: income solid green,
// expenses hatched red, both with rounded tops so their heights compare
// directly.
export function HomeBalanceChart({ monthlyTrend }: HomeBalanceChartProps) {
  const t = useTranslations("scrn-home");
  const isMobile = useIsMobile();
  const [range, setRange] = useState<Range>("6");
  const hatchId = `expenses-hatch-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;

  // monthlyTrend already covers the full 12-month window server-side —
  // switching ranges is just a client-side slice, no refetch. Phones always
  // show 6 months (12 pairs of bars don't fit) and get no range toggle.
  const data = isMobile || range === "6" ? monthlyTrend.slice(-6) : monthlyTrend;

  const chartConfig = {
    income: { label: t("chart.income") },
    expenses: { label: t("chart.expenses") },
  } satisfies ChartConfig;

  if (data.every((month) => month.income === 0 && month.expenses === 0)) {
    return <p className="text-xs text-muted-foreground">{t("chart.empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Two items on the line: the legend and the range toggle. Wraps
          instead of squeezing, and `whitespace-nowrap` keeps each label in
          one piece. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="size-2.5 shrink-0 rounded-xs bg-positive" />
            {t("chart.income")}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="size-2.5 shrink-0 rounded-xs bg-negative" />
            {t("chart.expenses")}
          </span>
        </div>
        {!isMobile && (
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
        )}
      </div>

      <ChartContainer config={chartConfig} className="h-64 w-full">
        <BarChart
          data={data}
          margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
          barGap={4}
          barCategoryGap="20%"
        >
          <defs>
            <pattern
              id={hatchId}
              patternUnits="userSpaceOnUse"
              width="6"
              height="6"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="var(--negative)" fillOpacity={0.3} />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--negative)" strokeWidth={3} />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
          <XAxis
            dataKey="monthLabel"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            // 10% headroom so the tallest bar's rounded top isn't clipped.
            domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]}
            tickLine={false}
            axisLine={false}
            width={isMobile ? 38 : 56}
            tick={{ fontSize: 11 }}
            tickFormatter={(value: number) =>
              (isMobile ? compactNumberFormatter : compactMoneyFormatter).format(value)
            }
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
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
          <Bar
            dataKey="income"
            fill="var(--positive)"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="expenses"
            fill={`url(#${hatchId})`}
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
