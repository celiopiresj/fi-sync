"use client";

import { createElement } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { WarningCircleIcon, CheckIcon, TrendUpIcon } from "@phosphor-icons/react";
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
  const colorClass = item.category.colorStyle || "bg-muted text-muted-foreground";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-card p-4 transition-shadow hover:shadow-md",
        isOverBudget ? "border-negative/30" : "border-border",
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
          variant="outline"
          className={cn(
            "shrink-0",
            isOverBudget
              ? "border-negative/30 bg-negative/10 text-negative"
              : "border-positive/30 bg-positive/10 text-positive",
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
              isOverBudget ? "font-semibold text-negative" : "text-foreground",
            )}
          >
            {t("item.spentLabel", { value: money(item.spent) })}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {t("item.limitLabel", { value: money(item.limit) })}
          </span>
        </div>

        <BudgetProgressBar percentage={item.percentage} limit={money(item.limit)} />

        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              isOverBudget ? "text-negative" : "text-muted-foreground",
            )}
          >
            {isOverBudget && <TrendUpIcon className="size-3" />}
            {isOverBudget
              ? t("item.exceededBy", { amount: money(item.spent - item.limit) })
              : t("item.available", { amount: money(item.limit - item.spent) })}
          </span>

          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("buttons.adjust")}
          </button>
        </div>
      </div>
    </div>
  );
}
