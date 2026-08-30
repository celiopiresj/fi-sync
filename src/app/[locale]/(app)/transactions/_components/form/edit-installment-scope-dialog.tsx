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
  // "future" only makes sense — and only gets offered — when the amount
  // itself changed; a description/category/status/split edit always
  // just chooses between "this one" and "every installment", the same
  // way a recurring-event editor's "this event" vs "all events" choice
  // works, minus the "and following" variant those don't need either.
  isAmountChange: boolean;
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
  isAmountChange,
  isSubmitting,
  onChooseScope,
}: EditInstallmentScopeDialogProps) {
  const t = useTranslations("scrn-transactions");

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
            className="w-full"
            disabled={isSubmitting}
            onClick={() => onChooseScope("this")}
          >
            {t("dialog.editInstallmentScope.this")}
          </Button>
          {isAmountChange && (
            <Button
              variant="outline"
              className="w-full"
              disabled={isSubmitting}
              onClick={() => onChooseScope("future")}
            >
              {t("dialog.editInstallmentScope.future")}
            </Button>
          )}
          <Button
            className="w-full"
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
