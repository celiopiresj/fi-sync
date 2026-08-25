"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, Cell, ReferenceLine, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useMonthlyBalances } from "../../_hooks/use-monthly-balances";
import type { Period } from "../../_lib/period";

// Fixed pt-BR formatter, matching the chart's month labels (see
// _lib/format-month-label.ts) — this card isn't locale-dependent.
const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type MonthlyBalanceChartProps = {
  // The header stepper's currently selected month — the chart's trailing
  // 7-month window is anchored here (see getMonthlyBalances in
  // actions.ts), so stepping the header re-centers the chart instead of
  // leaving it pinned to the real current month. Only the account filter
  // applies otherwise; search/category/type don't.
  period: Period;
  accountId?: string;
  onSelectMonth: (month: string) => void;
};

export function MonthlyBalanceChart({
  period,
  accountId,
  onSelectMonth,
}: MonthlyBalanceChartProps) {
  const t = useTranslations("scrn-transactions");
  const { data } = useMonthlyBalances(accountId, period);

  const chartConfig = {
    balance: { label: t("chart.monthlyBalance.tooltipLabel") },
  } satisfies ChartConfig;

  if (!data) return null;

  if (data.every((month) => month.balance === 0)) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("chart.monthlyBalance.empty")}
      </p>
    );
  }

  // getMonthlyBalances returns "6 months before `period` + `period`
  // itself", oldest first — the last entry is always the selected month
  // by construction, no separate flag needed to know which bar to
  // highlight.
  const selectedIndex = data.length - 1;

  return (
    <ChartContainer config={chartConfig} className="h-20 w-full">
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <ReferenceLine y={0} stroke="var(--border)" />
        <XAxis
          dataKey="monthLabel"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10 }}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t("chart.monthlyBalance.tooltipLabel")}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {moneyFormatter.format(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="balance" radius={4}>
          {data.map((month, index) => (
            <Cell
              key={month.month}
              style={{ cursor: "pointer" }}
              onClick={() => onSelectMonth(month.month)}
              fill={
                index === selectedIndex
                  ? "var(--chart-1)"
                  : month.balance < 0
                    ? "var(--destructive)"
                    : "var(--muted)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
