"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("cards.expectedIncome.title")}
          </span>
          <span className="text-2xl font-bold tabular-nums">
            {money(budget.expectedIncome)}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("cards.totalBudgeted.title")}
          </span>
          <span className="text-2xl font-bold tabular-nums">
            {money(totalBudgeted)}
          </span>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {t("cards.totalBudgeted.percentage", {
              percentage: allocatedPercentage,
            })}
          </span>
        </CardContent>
      </Card>

      <Card
        className={cn(
          isSpentOverLimit && "border-destructive/30 dark:border-destructive/40",
        )}
      >
        <CardContent className="flex flex-col gap-1">
          <span
            className={cn(
              "text-xs font-medium",
              isSpentOverLimit ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {t("cards.totalSpent.title")}
          </span>
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              isSpentOverLimit && "text-destructive",
            )}
          >
            {money(totalSpent)}
          </span>
          <span
            className={cn(
              "text-xs font-semibold",
              isSpentOverLimit ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {t("cards.totalSpent.percentage", {
              percentage: spentPercentage,
            })}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("cards.remainingIncome.title")}
          </span>
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              isIncomeOverAllocated
                ? "text-destructive"
                : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {money(remainingIncome)}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("cards.remainingIncome.subtitle")}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
