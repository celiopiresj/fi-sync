"use client";

import { computeBudgetAllocation } from "@/app/[locale]/(app)/budgets/_lib/budget-allocation";
import type { CategoryRow } from "@/app/[locale]/(app)/categories/_types/types";
import type { OnboardingCategory } from "./categories-step";
import { AmountInput } from "@/components/form/amount-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import {
  ChartPieIcon,
  PlusIcon,
  SparkleIcon,
  WalletIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useFormatter, useTranslations } from "next-intl";

export type OnboardingBudgetItem = { categoryId: string; limit: string };
export type OnboardingBudget = {
  expectedIncome: string;
  items: OnboardingBudgetItem[];
};

type BudgetStepProps = {
  // The already-seeded categories.
  categories: CategoryRow[];
  // Whatever's been added so far in the categories step, still
  // client-only (see OnboardingCategory's own comment) — combined with
  // `categories` below so a just-added custom category can get a limit
  // here too, before it's ever written to the database. Its `id` is a
  // temporary client-generated one; onboarding-wizard.tsx remaps it to
  // the real Category id (from createCategory's return) at final submit.
  draftCategories: OnboardingCategory[];
  value: OnboardingBudget;
  onChange: (value: OnboardingBudget) => void;
};

// Common shape both `categories` (real CategoryRow) and `draftCategories`
// (OnboardingCategory, no id collision risk since one comes from
// crypto.randomUUID() and the other from cuid()) are narrowed to for the
// parts of this component that don't care which kind a category is —
// selecting it, showing its icon/color/name.
type SelectableCategory = {
  id: string;
  name: string;
  colorStyle: string | null;
  icon: string | null;
};

// The 4 most common expense categories from DEFAULT_CATEGORIES
// (src/lib/default-categories.ts), looked up by name rather than
// hardcoded ids — same "categories step" spirit as CategoriesStep, so
// this stays correct even if a given user's seeded set ever changes.
// Missing from `categories` (shouldn't normally happen) just means that
// one chip is skipped, not an error.
const QUICK_ADD_CATEGORY_NAMES = ["Alimentação", "Moradia", "Transporte", "Lazer"];

type FinancialHealth = "excellent" | "good" | "attention";

function financialHealthOf(percentage: number, isOverBudget: boolean): FinancialHealth {
  if (isOverBudget || percentage > 80) return "attention";
  if (percentage > 50) return "good";
  return "excellent";
}

const HEALTH_TEXT_CLASS: Record<FinancialHealth, string> = {
  excellent: "text-positive",
  good: "text-warning",
  attention: "text-destructive",
};

const PROGRESS_BAR_CLASS: Record<FinancialHealth, string> = {
  excellent: "bg-gradient-to-r from-emerald-400 to-teal-500",
  good: "bg-gradient-to-r from-amber-400 to-orange-500",
  attention: "bg-destructive",
};

// Optional, single-item — a user only has one budget per month. Reuses
// computeBudgetAllocation (budgets/_lib) for the live summary instead of
// re-deriving the dinero.js math, same "deliberate cross-route _lib
// import" exception as the Server Actions this wizard reuses.
export function BudgetStep({
  categories,
  draftCategories,
  value,
  onChange,
}: BudgetStepProps) {
  const t = useTranslations("scrn-onboarding");
  const tBudgets = useTranslations("scrn-budgets");
  const format = useFormatter();

  const allocation = computeBudgetAllocation(
    value.expectedIncome,
    value.items.map((item) => item.limit),
  );
  const clampedPercentage = Math.min(Math.max(allocation.percentage, 0), 100);
  const hasIncome = Number(value.expectedIncome.replace(",", ".")) > 0;
  const health = financialHealthOf(allocation.percentage, allocation.isOverBudget);

  function money(amount: number) {
    return format.number(amount, { style: "currency", currency: "BRL" });
  }

  const allCategories: SelectableCategory[] = [...categories, ...draftCategories];
  const availableCategories = allCategories.filter(
    (category) => !value.items.some((item) => item.categoryId === category.id),
  );
  const quickAddCategories = QUICK_ADD_CATEGORY_NAMES.map((name) =>
    categories.find((category) => category.name === name),
  ).filter(
    (category): category is CategoryRow =>
      category !== undefined &&
      !value.items.some((item) => item.categoryId === category.id),
  );

  function addItem(categoryId: string) {
    onChange({ ...value, items: [...value.items, { categoryId, limit: "" }] });
  }

  function removeItem(index: number) {
    onChange({ ...value, items: value.items.filter((_, i) => i !== index) });
  }

  function updateLimit(index: number, limit: string) {
    onChange({
      ...value,
      items: value.items.map((item, i) =>
        i === index ? { ...item, limit } : item,
      ),
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-1 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <WalletIcon className="size-4 text-positive" />
              {t("steps.budget.income.label")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("steps.budget.income.helper")}
            </span>
          </div>
          <AmountInput
            size="lg"
            value={value.expectedIncome}
            onChange={(income) => onChange({ ...value, expectedIncome: income })}
            placeholder={tBudgets("fields.expectedIncome.placeholder")}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {t("steps.budget.limits.title")}
            </h3>
            <span className="text-xs text-muted-foreground">
              {t("steps.budget.limits.helper")}
            </span>
          </div>

          {quickAddCategories.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("steps.budget.limits.quickAdd")}
              </span>
              <div className="flex flex-wrap gap-2">
                {quickAddCategories.map((category) => {
                  const CategoryIcon = resolveCategoryIcon(category.icon);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => addItem(category.id)}
                      className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent/50">
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full",
                          category.colorStyle || "bg-muted text-muted-foreground",
                        )}>
                        <CategoryIcon className="size-3" />
                      </span>
                      + {category.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {value.items.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">
                {t("steps.budget.empty")}
              </p>
            )}

            {value.items.map((item, index) => {
              const category = allCategories.find((c) => c.id === item.categoryId);
              if (!category) return null;
              const CategoryIcon = resolveCategoryIcon(category.icon);

              return (
                <div
                  key={item.categoryId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full",
                        category.colorStyle || "bg-muted text-muted-foreground",
                      )}>
                      <CategoryIcon className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{category.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("steps.budget.limits.monthlyLimit")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <AmountInput
                      className="w-28 shrink-0 bg-surface-1"
                      value={item.limit}
                      onChange={(limit) => updateLimit(index, limit)}
                      placeholder={tBudgets("fields.categoryLimit.placeholder")}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeItem(index)}>
                      <XIcon />
                      <span className="sr-only">{t("buttons.remove")}</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {availableCategories.length > 0 && (
            <Select onValueChange={addItem}>
              <SelectTrigger className="border-dashed">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <PlusIcon className="size-4" />
                  <span className="text-sm">{t("steps.budget.addCategory")}</span>
                </div>
              </SelectTrigger>
              {/* position="popper" — this trigger has no value/defaultValue,
                  so Radix's default item-aligned positioning (which anchors
                  to the currently-selected item) has nothing to align to and
                  renders the dropdown detached from the trigger. */}
              <SelectContent position="popper">
                {availableCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {hasIncome ? (
          <>
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <ChartPieIcon className="size-4" />
                  {t("steps.budget.overview.title")}
                </span>
                <Badge
                  className={cn(
                    "bg-transparent",
                    allocation.isOverBudget
                      ? "bg-destructive/10 text-destructive"
                      : "bg-positive/10 text-positive",
                  )}>
                  {tBudgets(
                    allocation.isOverBudget
                      ? "summary.allocatedBadgeOverBudget"
                      : "summary.allocatedBadge",
                    { percentage: allocation.percentage },
                  )}
                </Badge>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    PROGRESS_BAR_CLASS[health],
                  )}
                  style={{ width: `${clampedPercentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">
                  {t("steps.budget.overview.commitment")}
                </span>
                <span className={HEALTH_TEXT_CLASS[health]}>
                  {t(`steps.budget.overview.health.${health}`)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5 rounded-lg bg-muted/50 p-3">
                  <span className="text-xs text-muted-foreground uppercase">
                    {tBudgets("cards.totalBudgeted.title")}
                  </span>
                  <span className="text-base font-bold tabular-nums">
                    {money(allocation.allocatedAmount)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("steps.budget.overview.allocatedHelper")}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-lg bg-positive/10 p-3">
                  <span className="text-xs font-medium text-positive uppercase">
                    {tBudgets("cards.remainingIncome.title")}
                  </span>
                  <span className="text-base font-bold tabular-nums text-positive">
                    {money(allocation.remainingAmount)}
                  </span>
                  <span className="text-xs text-positive/80">
                    {t("steps.budget.overview.remainingHelper")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border border-warning/30 bg-warning/10 p-4">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-warning">
                <SparkleIcon className="size-4" />
                {t("steps.budget.tip.title")}
              </span>
              <p className="text-xs text-warning/90">
                {t("steps.budget.tip.description")}
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <ChartPieIcon className="size-8" />
            {t("steps.budget.overview.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
