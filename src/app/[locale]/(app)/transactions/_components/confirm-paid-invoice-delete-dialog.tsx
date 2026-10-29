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

type ConfirmPaidInvoiceDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  isBulk?: boolean;
};

export function ConfirmPaidInvoiceDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  isBulk,
}: ConfirmPaidInvoiceDeleteDialogProps) {
  const t = useTranslations("scrn-transactions");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("aria.close")}>
        <DialogHeader>
          <DialogTitle>
            {isBulk
              ? t("dialog.confirmPaidInvoiceDelete.titleBulk")
              : t("dialog.confirmPaidInvoiceDelete.title")}
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? t("dialog.confirmPaidInvoiceDelete.descriptionBulk")
              : t("dialog.confirmPaidInvoiceDelete.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {t("dialog.confirmPaidInvoiceDelete.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
          >
            {t("dialog.confirmPaidInvoiceDelete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

