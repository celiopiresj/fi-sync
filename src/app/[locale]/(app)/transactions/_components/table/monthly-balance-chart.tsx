"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormatter, useTranslations } from "next-intl";
import { Bar, BarChart, Cell, ReferenceLine, XAxis } from "recharts";
import { useMonthlyBalances } from "../../_hooks/use-monthly-balances";
import type { Period } from "../../_lib/period";

type MonthlyBalanceChartProps = {
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
  const format = useFormatter();
  const { data } = useMonthlyBalances(accountId, period);

  const chartConfig = {
    balance: { label: t("chart.monthlyBalance.tooltipLabel") },
  } satisfies ChartConfig;

  if (!data) {
    return <Skeleton className="h-20 w-full rounded-lg" />;
  }

  if (data.every((month) => month.balance === 0)) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("chart.monthlyBalance.empty")}
      </p>
    );
  }

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
                    ? "var(--negative)"
                    : "var(--muted)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
