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

type CopyPreviousConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
  previousMonthLabel: string;
  currentMonthLabel: string;
};

// Confirms overwriting the CURRENT month's budget with a copy of the
// previous one's limits/groups — only ever opened from the "Editar"
// menu's own "Copiar do mês anterior" item (budgets-view.tsx), which is
// only shown once the current month already has a budget to replace.
// The empty-state's own copy shortcut (BudgetSheet's "Importar orçamento
// de {month}") has nothing to overwrite (budget is null there) and skips
// this confirmation entirely.
export function CopyPreviousConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  previousMonthLabel,
  currentMonthLabel,
}: CopyPreviousConfirmDialogProps) {
  const t = useTranslations("scrn-budgets.dialog.copyPrevious");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("description", {
              previousMonth: previousMonthLabel,
              currentMonth: currentMonthLabel,
            })}
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
