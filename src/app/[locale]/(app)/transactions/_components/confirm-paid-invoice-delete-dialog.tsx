"use client";

import { useTranslations } from "next-intl";
import { SpinnerIcon, WarningCircleIcon } from "@phosphor-icons/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-warning/10 text-warning">
            <WarningCircleIcon aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {isBulk
              ? t("dialog.confirmPaidInvoiceDelete.titleBulk")
              : t("dialog.confirmPaidInvoiceDelete.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk
              ? t("dialog.confirmPaidInvoiceDelete.descriptionBulk")
              : t("dialog.confirmPaidInvoiceDelete.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} className="h-11 sm:h-9">
            {t("dialog.confirmPaidInvoiceDelete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            className="h-11 sm:h-9"
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isPending && (
              <SpinnerIcon aria-hidden="true" className="animate-spin" />
            )}
            {t("dialog.confirmPaidInvoiceDelete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
