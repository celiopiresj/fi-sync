"use client";

import { createElement } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { WarningCircleIcon, CheckIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { BudgetProgressBar } from "./budget-progress-bar";
import type { BudgetItemWithSpending } from "../_types/types";

type BudgetItemCardProps = {
  item: BudgetItemWithSpending;
  onEdit: () => void;
};

export function BudgetItemCard({ item, onEdit }: BudgetItemCardProps) {
  const t = useTranslations("scrn-budgets");
  const format = useFormatter();

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  const isOverBudget = item.spent > item.limit;
  const percentage = Math.round(item.percentage);
  const colorClass =
    item.category.colorStyle ||
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-card p-4 transition-shadow hover:shadow-md",
        isOverBudget
          ? "border-destructive/30 dark:border-destructive/40"
          : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg font-bold",
              colorClass,
            )}
          >
            {createElement(resolveCategoryIcon(item.category.icon), {
              className: "size-4.5",
            })}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {item.category.name}
            </p>
            {item.group ? (
              <p className="truncate text-xs text-muted-foreground">
                {item.group.name}
              </p>
            ) : null}
          </div>
        </div>

        <Badge
          variant={isOverBudget ? "destructive" : "outline"}
          className={cn(
            "shrink-0",
            !isOverBudget &&
              "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400",
          )}
        >
          {isOverBudget ? <WarningCircleIcon /> : <CheckIcon />}
          {isOverBudget
            ? t("item.overLimitBadge", { percentage })
            : t("item.usedBadge", { percentage })}
        </Badge>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span
            className={cn(
              "tabular-nums",
              isOverBudget
                ? "font-semibold text-destructive"
                : "text-foreground",
            )}
          >
            {t("item.spent", {
              spent: money(item.spent),
              limit: money(item.limit),
            })}
          </span>
        </div>

        <BudgetProgressBar percentage={item.percentage} limit={money(item.limit)} />

        <span
          className={cn(
            "text-xs font-medium",
            isOverBudget ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {isOverBudget
            ? t("item.exceededBy", { amount: money(item.spent - item.limit) })
            : t("item.available", { amount: money(item.limit - item.spent) })}
        </span>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="self-end text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {t("buttons.adjust")}
      </button>
    </div>
  );
}
