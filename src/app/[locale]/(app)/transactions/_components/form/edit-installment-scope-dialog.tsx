"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type EditInstallmentScopeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installmentNumber: number;
  installmentCount: number;
  isSubmitting: boolean;
  onChooseScope: (scope: "this" | "all" | "future") => void;
};

// Shown by CreditTransactionForm right before submit when editing a
// transaction that's already part of an installment group (see
// updateCreditTransaction's own editScope handling, transactions/actions.ts)
// — lets the user pick how far the edit should reach instead of it
// silently applying to just this one row.
export function EditInstallmentScopeDialog({
  open,
  onOpenChange,
  installmentNumber,
  installmentCount,
  isSubmitting,
  onChooseScope,
}: EditInstallmentScopeDialogProps) {
  const t = useTranslations("scrn-transactions");
  const hasFutureInstallments = installmentNumber < installmentCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("aria.close")}>
        <DialogHeader>
          <DialogTitle>
            {t("dialog.editInstallmentScope.title", {
              number: installmentNumber,
              total: installmentCount,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("dialog.editInstallmentScope.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="outline"
            className="h-11 w-full sm:h-9"
            disabled={isSubmitting}
            onClick={() => onChooseScope("this")}
          >
            {t("dialog.editInstallmentScope.this")}
          </Button>
          {hasFutureInstallments && (
            <Button
              variant="outline"
              className="h-11 w-full sm:h-9"
              disabled={isSubmitting}
              onClick={() => onChooseScope("future")}
            >
              {t("dialog.editInstallmentScope.future")}
            </Button>
          )}
          <Button
            className="h-11 w-full sm:h-9"
            disabled={isSubmitting}
            onClick={() => onChooseScope("all")}
          >
            {t("dialog.editInstallmentScope.all")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
