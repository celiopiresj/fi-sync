"use client";

import { createElement } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { BudgetProgressBar } from "./budget-progress-bar";
import type { BudgetItemWithSpending } from "../_types/types";

type BudgetItemRowProps = {
  item: BudgetItemWithSpending;
};

export function BudgetItemRow({ item }: BudgetItemRowProps) {
  const t = useTranslations("scrn-budgets");
  const format = useFormatter();

  const spentFormatted = format.number(item.spent, {
    style: "currency",
    currency: "BRL",
  });
  const limitFormatted = format.number(item.limit, {
    style: "currency",
    currency: "BRL",
  });

  const isOverBudget = item.percentage > 100;
  const colorClass =
    item.category.colorStyle ||
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";

  return (
    <div className="flex flex-col gap-1.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg",
              colorClass,
            )}
          >
            {createElement(resolveCategoryIcon(item.category.icon), {
              className: "size-3.5",
            })}
          </div>
          <span className="truncate text-sm font-medium">
            {item.category.name}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm tabular-nums text-muted-foreground">
            {t("item.spent", {
              spent: spentFormatted,
              limit: limitFormatted,
            })}
          </span>
          <span
            className={`text-xs tabular-nums font-medium ${
              isOverBudget
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {isOverBudget
              ? t("item.overBudget")
              : t("item.percentage", {
                  percentage: Math.round(item.percentage).toString(),
                })}
          </span>
        </div>
      </div>
      <BudgetProgressBar
        percentage={item.percentage}
        limit={limitFormatted}
      />
    </div>
  );
}
