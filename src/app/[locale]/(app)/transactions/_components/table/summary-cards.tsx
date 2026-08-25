"use client";

import { APP_TIME_ZONE } from "@/lib/date";
import { cn } from "@/lib/utils";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo } from "react";
import type { TransactionRow } from "../../_types/types";
import type { TransactionFilters } from "../../actions";
import type { Period } from "../../_lib/period";
import { CategoryBreakdownList } from "./category-breakdown-list";
import { MonthlyBalanceChart } from "./monthly-balance-chart";

type SummaryCardsProps = {
  transactions: TransactionRow[];
  // undefined while the previous-period comparison query is still
  // loading; [] once loaded with genuinely no data for that period —
  // these render differently (nothing vs. "sem dados de {month}"), see
  // below.
  previousTransactions: TransactionRow[] | undefined;
  // Midnight of the 1st of the previous period, already resolved through
  // parseCalendarDate by the caller (transactions-view.tsx) — this
  // component only needs it for the comparison text's month name.
  previousPeriodDate: Date;
  // The header stepper's currently selected month — passed straight
  // through to the monthly-balance chart, which anchors its trailing
  // 7-month window here (see getMonthlyBalances in actions.ts) instead of
  // always the real current month. Account is the only OTHER filter that
  // reaches that chart; search/category don't. The category breakdown
  // gets the full current filters (same object passed to
  // listTransactions).
  accountId?: string;
  period: Period;
  filters: TransactionFilters;
  onSelectMonth: (month: string) => void;
  onSelectCategory: (categoryId: string) => void;
};

function sumIncomeExpenses(transactions: TransactionRow[]) {
  let income = 0;
  let expenses = 0; // stays <= 0, same sign convention as Transaction.amount
  for (const transaction of transactions) {
    if (transaction.amount >= 0) {
      income += transaction.amount;
    } else {
      expenses += transaction.amount;
    }
  }
  return { income, expenses, balance: income + expenses };
}

export function SummaryCards({
  transactions,
  previousTransactions,
  previousPeriodDate,
  accountId,
  period,
  filters,
  onSelectMonth,
  onSelectCategory,
}: SummaryCardsProps) {
  const t = useTranslations("scrn-transactions");
  const format = useFormatter();

  const { income, expenses, balance } = useMemo(
    () => sumIncomeExpenses(transactions),
    [transactions],
  );

  const money = (value: number) =>
    format.number(value, { style: "currency", currency: "BRL" });

  // Bar segments are proportional to income vs. |expenses| directly, not
  // to their share of the balance — a period with large offsetting
  // income and expenses (balance near zero) should still show two
  // full-size segments, not two slivers either side of an empty middle.
  const total = income + Math.abs(expenses);
  const incomeShare = total > 0 ? (income / total) * 100 : 50;
  const expensesShare = 100 - incomeShare;

  const previousMonthLabel = format.dateTime(previousPeriodDate, {
    month: "long",
    timeZone: APP_TIME_ZONE,
  });

  // Branches on `previousTransactions` itself throughout (rather than a
  // separately-memoized derived value) so TypeScript can narrow it from
  // `TransactionRow[] | undefined` on its own — no non-null assertions
  // needed to reach `.length`/pass it to sumIncomeExpenses below.
  let comparisonText: string | null = null;
  if (previousTransactions !== undefined) {
    if (previousTransactions.length === 0) {
      comparisonText = t("summary.comparisonUnavailable", {
        month: previousMonthLabel,
      });
    } else {
      const diff = balance - sumIncomeExpenses(previousTransactions).balance;
      if (Math.abs(diff) < 0.005) {
        comparisonText = t("summary.comparisonEqual", {
          month: previousMonthLabel,
        });
      } else if (diff > 0) {
        comparisonText = t("summary.comparisonAbove", {
          value: money(Math.abs(diff)),
          month: previousMonthLabel,
        });
      } else {
        comparisonText = t("summary.comparisonBelow", {
          value: money(Math.abs(diff)),
          month: previousMonthLabel,
        });
      }
    }
  }

  return (
    <div className="flex flex-col divide-y-[0.5px] divide-border rounded-lg bg-surface-1 lg:flex-row lg:divide-x-[0.5px] lg:divide-y-0">
      <div className="flex w-full min-w-0 flex-col gap-4 p-4 lg:flex-1">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {t("summary.balanceLabel")}
          </span>
          <span
            className={cn(
              "text-[26px] font-medium tabular-nums",
              balance >= 0 ? "text-positive" : "text-negative",
            )}>
            {money(balance)}
          </span>
          {/* Reserves its line even while loading, so the card's height
              doesn't jump once the comparison query resolves. */}
          <span className="text-xs text-muted-foreground">
            {comparisonText ?? " "}
          </span>
        </div>

        <div className="flex h-2.5 w-full max-w-105 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-positive"
            style={{ width: `${incomeShare}%` }}
          />
          <div
            className="h-full bg-negative"
            style={{ width: `${expensesShare}%` }}
          />
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-foreground">
            <span className="size-2 shrink-0 rounded-full bg-positive" />
            {t("summary.legendIncome", { value: money(income) })}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-foreground">
            <span className="size-2 shrink-0 rounded-full bg-negative" />
            {t("summary.legendExpenses", { value: money(Math.abs(expenses)) })}
          </span>
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-2 p-4 lg:flex-1">
        <span className="text-xs text-muted-foreground">
          {t("chart.monthlyBalance.title")}
        </span>
        <MonthlyBalanceChart
          period={period}
          accountId={accountId}
          onSelectMonth={onSelectMonth}
        />
      </div>

      <div className="flex w-full min-w-0 flex-col gap-2 p-4 lg:flex-1">
        <span className="text-xs text-muted-foreground">
          {t("chart.byCategory.title")}
        </span>
        <CategoryBreakdownList
          filters={filters}
          onSelectCategory={onSelectCategory}
        />
      </div>
    </div>
  );
}
