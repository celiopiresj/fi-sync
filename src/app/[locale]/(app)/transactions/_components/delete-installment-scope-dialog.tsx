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

type DeleteInstallmentScopeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installmentNumber: number;
  installmentCount: number;
  isPending: boolean;
  onChooseScope: (scope: "this" | "all") => void;
};

// Shown after deleteTransaction (actions.ts) reports the row being
// deleted is part of an installment group with nothing paid yet
// (`needsInstallmentScope`) — lets the user pick between removing just
// this one installment or the whole purchase, instead of silently
// leaving the rest of the schedule behind. Same shape as
// form/edit-installment-scope-dialog.tsx, minus the "future" option
// (which only makes sense for an edit propagating forward, not a
// delete).
export function DeleteInstallmentScopeDialog({
  open,
  onOpenChange,
  installmentNumber,
  installmentCount,
  isPending,
  onChooseScope,
}: DeleteInstallmentScopeDialogProps) {
  const t = useTranslations("scrn-transactions");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("aria.close")}>
        <DialogHeader>
          <DialogTitle>
            {t("dialog.deleteInstallmentScope.title", {
              number: installmentNumber,
              total: installmentCount,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("dialog.deleteInstallmentScope.description", {
              total: installmentCount,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="outline"
            className="w-full"
            disabled={isPending}
            onClick={() => onChooseScope("this")}
          >
            {t("dialog.deleteInstallmentScope.this")}
          </Button>
          <Button
            variant="destructive"
            className="w-full"
            disabled={isPending}
            onClick={() => onChooseScope("all")}
          >
            {t("dialog.deleteInstallmentScope.all", { total: installmentCount })}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {t("dialog.deleteInstallmentScope.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
