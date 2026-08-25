"use client";

import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useStore } from "@tanstack/react-form";
import { PlusIcon, SpinnerIcon, XIcon } from "@phosphor-icons/react";
import { useZodForm } from "@/lib/form/use-zod-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AmountInput } from "@/components/form/amount-field";
import { cn } from "@/lib/utils";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { budgetSchema, type BudgetFormValues } from "../../_schema/schema";
import { computeBudgetAllocation } from "../../_lib/budget-allocation";
import { BAR_CLASSES } from "../budget-progress-bar";
import type { CategoryOption, GroupOption } from "../../_types/types";

// UI-only sentinel for "no group" — Radix `SelectItem` can't take an
// empty-string `value`, so this stands in for it in the form/select
// layer and is converted to `undefined` right before onSubmit, same
// spot budgetItemSchema's `groupId` (z.string().optional()) expects.
const NO_GROUP = "none";

type BudgetFormProps = {
  categories: CategoryOption[];
  groups: GroupOption[];
  initialValues: BudgetFormValues;
  onSubmit: (values: BudgetFormValues) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
};

export function BudgetForm({
  categories,
  groups,
  initialValues,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: BudgetFormProps) {
  const t = useTranslations("scrn-budgets");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  const form = useZodForm(budgetSchema, {
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      await onSubmit({
        expectedIncome: value.expectedIncome,
        items: value.items.map((item) => ({
          ...item,
          groupId: item.groupId === NO_GROUP ? undefined : item.groupId,
        })),
      });
    },
  });

  const expectedIncome = useStore(
    form.store,
    (state) => state.values.expectedIncome,
  );
  const items = useStore(form.store, (state) => state.values.items);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  // Recomputed on every keystroke of the income field or any item's
  // limit — see _lib/budget-allocation.ts for why this goes through
  // dinero.js instead of plain +/- on the raw strings.
  const allocation = useMemo(
    () =>
      computeBudgetAllocation(
        expectedIncome,
        items.map((item) => item.limit),
      ),
    [expectedIncome, items],
  );
  const clampedPercentage = Math.min(Math.max(allocation.percentage, 0), 100);

  const availableCategories = categories.filter(
    (cat) => !items.some((item) => item.categoryId === cat.id),
  );

  function categoryName(categoryId: string): string {
    return categories.find((c) => c.id === categoryId)?.name ?? "";
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex h-full flex-col"
    >
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
        <form.AppField name="expectedIncome">
          {(field) => (
            <field.AmountField
              label={t("fields.expectedIncome.label")}
              placeholder={t("fields.expectedIncome.placeholder")}
              size="lg"
            />
          )}
        </form.AppField>

        {/* Real-time allocation summary — recomputed from the live form
            state above, not a snapshot taken at open time. */}
        <Card className="gap-3 bg-surface-1 py-4">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 text-xs font-medium">
              <span className="text-muted-foreground">{t("summary.title")}</span>
              <Badge variant={allocation.isOverBudget ? "destructive" : "default"}>
                {t(
                  allocation.isOverBudget
                    ? "summary.allocatedBadgeOverBudget"
                    : "summary.allocatedBadge",
                  { percentage: allocation.percentage },
                )}
              </Badge>
            </div>

            <div
              role="progressbar"
              aria-valuenow={clampedPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("aria.allocationBar", {
                percentage: allocation.percentage,
                income: money(allocation.allocatedAmount),
              })}
              className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  allocation.isOverBudget ? BAR_CLASSES.red : BAR_CLASSES.green,
                )}
                style={{ width: `${clampedPercentage}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-[10px] text-muted-foreground uppercase">
                  {t("summary.allocatedLabel")}
                </span>
                <span className="font-bold tabular-nums">
                  {money(allocation.allocatedAmount)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 text-right">
                <span className="font-bold text-[10px] text-muted-foreground uppercase">
                  {t("summary.remainingLabel")}
                </span>
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    allocation.isOverBudget && "text-destructive",
                  )}
                >
                  {money(allocation.remainingAmount)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium">
            {t("fields.categoryLimit.label")}
          </span>

          {items.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">
              {t("empty.description")}
            </p>
          )}

          {items.map((item, index) => {
            const category = categories.find((cat) => cat.id === item.categoryId);
            const CategoryIcon = resolveCategoryIcon(category?.icon);
            const colorClass =
              category?.colorStyle || "bg-muted text-muted-foreground";
            return (
              <div
                key={item.categoryId}
                className="flex items-center gap-3 border-b border-border py-3 last:border-none"
              >
                <form.AppField name={`items[${index}].limit`}>
                  {(field) => (
                    <AmountInput
                      className="w-32 shrink-0"
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      placeholder={t("fields.categoryLimit.placeholder")}
                      aria-label={t("fields.categoryLimit.label")}
                    />
                  )}
                </form.AppField>

                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      colorClass,
                    )}
                  >
                    <CategoryIcon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {categoryName(item.categoryId)}
                    </p>
                    {groups.length > 0 && (
                      <form.AppField name={`items[${index}].groupId`}>
                        {(field) => (
                          <Select
                            value={field.state.value}
                            onValueChange={field.handleChange}
                          >
                            <SelectTrigger
                              aria-label={t("fields.group.label")}
                              className="h-5 w-fit gap-1 border-none bg-transparent px-0 text-[10px] font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=open]:text-foreground [&_svg]:size-3"
                            >
                              <SelectValue placeholder={t("fields.group.none")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_GROUP}>
                                {t("fields.group.none")}
                              </SelectItem>
                              {groups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                  {group.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </form.AppField>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => form.removeFieldValue("items", index)}
                >
                  <XIcon />
                  <span className="sr-only">{t("buttons.removeCategory")}</span>
                </Button>
              </div>
            );
          })}

          {availableCategories.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center border-dashed text-muted-foreground"
                >
                  <PlusIcon />
                  {t("buttons.addCategory")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-64 overflow-y-auto" align="start">
                {availableCategories.map((cat) => {
                  const CategoryIcon = resolveCategoryIcon(cat.icon);
                  return (
                    <DropdownMenuItem
                      key={cat.id}
                      onSelect={() =>
                        form.pushFieldValue("items", {
                          categoryId: cat.id,
                          groupId: NO_GROUP,
                          limit: "",
                        })
                      }
                    >
                      <CategoryIcon />
                      {cat.name}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border bg-popover p-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {tCommon("buttons.cancel")}
        </Button>
        <Button
          type="submit"
          disabled={isPending || isSubmitting || items.length === 0}
        >
          {(isPending || isSubmitting) && (
            <SpinnerIcon className="animate-spin" />
          )}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
