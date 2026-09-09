"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SUGGESTION_MONTHS_COUNT } from "../../_constants/constants";

type SuggestLimitsConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
};

// Confirms creating the current month's budget from suggested limits —
// each category's own average spend over the last SUGGESTION_MONTHS_COUNT
// months (suggestBudgetLimits, budgets/actions.ts) — instead of copying
// an exact prior month (CopyPreviousConfirmDialog's own job) or filling
// the form by hand. Only ever opened from the empty state's "Sugerir com
// base nos últimos N meses" button, so there's nothing to overwrite here
// (unlike the copy dialog) — this only ever creates a brand new budget.
export function SuggestLimitsConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: SuggestLimitsConfirmDialogProps) {
  const t = useTranslations("scrn-budgets.dialog.suggest");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("description", { count: SUGGESTION_MONTHS_COUNT })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("cancel")}
          </AlertDialogCancel>
          <Button onClick={onConfirm} disabled={isPending} asChild>
            <AlertDialogAction>{t("confirm")}</AlertDialogAction>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
