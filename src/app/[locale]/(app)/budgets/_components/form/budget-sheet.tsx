"use client";

import { useTranslations } from "next-intl";
import { CopyIcon } from "@phosphor-icons/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BudgetForm } from "./budget-form";
import type { BudgetFormValues } from "../../_schema/schema";
import type { BudgetWithSpending, CategoryOption, GroupOption } from "../../_types/types";

// Same "none" sentinel BudgetForm uses for its group Select — an
// existing item's real groupId (or null, when ungrouped) is mapped to
// it here so the field starts on the right selection instead of blank.
const NO_GROUP = "none";

type BudgetSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  monthLabel: string;
  // Previous calendar month's label — only used by the "create" mode's
  // copy-shortcut button below; unused (and safe to omit) in "edit".
  previousMonthLabel: string;
  categories: CategoryOption[];
  groups: GroupOption[];
  budget: BudgetWithSpending | null;
  onSubmit: (values: BudgetFormValues) => Promise<void>;
  isPending: boolean;
  // Copies the previous month's whole budget in one step — an
  // alternative to filling the form by hand, shown only in "create"
  // mode (there's nothing to "copy over" once a budget already exists
  // to edit). Resolves the same ActionResult shape as
  // copyBudgetFromPreviousMonth so the sheet only closes on success.
  onCopyFromPrevious: () => Promise<{ error?: string }>;
  isCopyPending: boolean;
};

export function BudgetSheet({
  open,
  onOpenChange,
  mode,
  monthLabel,
  previousMonthLabel,
  categories,
  groups,
  budget,
  onSubmit,
  isPending,
  onCopyFromPrevious,
  isCopyPending,
}: BudgetSheetProps) {
  const t = useTranslations("scrn-budgets");

  const initialValues: BudgetFormValues =
    mode === "edit" && budget
      ? {
          expectedIncome: String(budget.expectedIncome),
          items: budget.items.map((item) => ({
            categoryId: item.categoryId,
            groupId: item.groupId ?? NO_GROUP,
            limit: String(item.limit),
          })),
        }
      : { expectedIncome: "", items: [] };

  async function handleSubmit(values: BudgetFormValues) {
    await onSubmit(values);
    onOpenChange(false);
  }

  async function handleCopyFromPrevious() {
    const result = await onCopyFromPrevious();
    if (!result.error) onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col data-[side=right]:sm:max-w-lg">
        <SheetHeader className="gap-3">
          <div>
            <SheetTitle>
              {t(mode === "create" ? "dialog.create.title" : "dialog.edit.title")}
            </SheetTitle>
            <SheetDescription>
              {mode === "create"
                ? t("dialog.create.description", { month: monthLabel })
                : t("dialog.edit.description")}
            </SheetDescription>
          </div>

          {mode === "create" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCopyPending}
              onClick={handleCopyFromPrevious}
            >
              <CopyIcon />
              {t("dialog.create.copyPreviousButton", { month: previousMonthLabel })}
            </Button>
          )}
        </SheetHeader>

        {/* Remount on mode/budget change so TanStack Form picks up fresh
            defaultValues instead of keeping the previous session's
            state — same convention as every other *-sheet.tsx. */}
        <div className="min-h-0 flex-1">
          <BudgetForm
            key={mode === "edit" ? (budget?.id ?? "edit") : "create"}
            categories={categories}
            groups={groups}
            initialValues={initialValues}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isPending={isPending}
            submitLabel={t(
              mode === "create" ? "buttons.create" : "buttons.edit",
            )}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
