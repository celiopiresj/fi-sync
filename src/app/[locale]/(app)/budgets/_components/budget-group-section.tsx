"use client";

import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { sumAmounts } from "../_lib/budget-calculations";
import { BudgetItemRow } from "./budget-item-row";
import { BudgetItemCard } from "./budget-item-card";
import type { BudgetItemWithSpending } from "../_types/types";

type BudgetGroupSectionProps = {
  name: string;
  items: BudgetItemWithSpending[];
  viewMode: "cards" | "list";
  onEditItem: () => void;
};

export function BudgetGroupSection({
  name,
  items,
  viewMode,
  onEditItem,
}: BudgetGroupSectionProps) {
  const t = useTranslations("scrn-budgets");
  const format = useFormatter();

  const totalSpent = sumAmounts(items.map((item) => item.spent));
  const totalLimit = sumAmounts(items.map((item) => item.limit));
  const isGroupOverBudget = totalSpent > totalLimit;

  const spentFormatted = format.number(totalSpent, {
    style: "currency",
    currency: "BRL",
  });
  const limitFormatted = format.number(totalLimit, {
    style: "currency",
    currency: "BRL",
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2.5 rounded-full",
              isGroupOverBudget ? "bg-destructive" : "bg-emerald-500",
            )}
          />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
            {name}
          </h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {t("group.categoryCount", { count: items.length })}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className={cn(isGroupOverBudget && "text-destructive")}>
            {t("group.spentLabel", { value: spentFormatted })}
          </span>
          <span className="font-normal text-muted-foreground">
            {t("group.limitLabel", { value: limitFormatted })}
          </span>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="divide-y rounded-lg border bg-card px-4">
          {items.map((item) => (
            <BudgetItemRow key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((item) => (
            <BudgetItemCard key={item.id} item={item} onEdit={onEditItem} />
          ))}
        </div>
      )}
    </div>
  );
}
