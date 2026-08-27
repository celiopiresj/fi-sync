"use client";

import { useFormatter, useTranslations } from "next-intl";
import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import { sumAmounts } from "../_lib/budget-calculations";
import type { BudgetWithSpending } from "../_types/types";

type SummaryCardsProps = {
  budget: BudgetWithSpending;
};

export function SummaryCards({ budget }: SummaryCardsProps) {
  const t = useTranslations("scrn-budgets");
  const format = useFormatter();

  const totalBudgeted = sumAmounts(budget.items.map((item) => item.limit));
  const totalSpent = sumAmounts(budget.items.map((item) => item.spent));
  const remainingIncome = sumAmounts([budget.expectedIncome, -totalBudgeted]);

  const allocatedPercentage =
    budget.expectedIncome > 0
      ? Math.round((totalBudgeted / budget.expectedIncome) * 100)
      : 0;
  const spentPercentage =
    totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  const isSpentOverLimit = totalSpent > totalBudgeted;
  const isIncomeOverAllocated = remainingIncome < 0;

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  return (
    <KpiGrid>
      <KpiCard
        label={t("cards.expectedIncome.title")}
        value={money(budget.expectedIncome)}
      />
      <KpiCard
        label={t("cards.totalBudgeted.title")}
        value={money(totalBudgeted)}
        subtitle={t("cards.totalBudgeted.percentage", {
          percentage: allocatedPercentage,
        })}
      />
      <KpiCard
        label={t("cards.totalSpent.title")}
        value={money(totalSpent)}
        tone={isSpentOverLimit ? "negative" : "default"}
        subtitle={t("cards.totalSpent.percentage", {
          percentage: spentPercentage,
        })}
      />
      <KpiCard
        label={t("cards.remainingIncome.title")}
        value={money(remainingIncome)}
        tone={isIncomeOverAllocated ? "negative" : "positive"}
        subtitle={t("cards.remainingIncome.subtitle")}
      />
    </KpiGrid>
  );
}
