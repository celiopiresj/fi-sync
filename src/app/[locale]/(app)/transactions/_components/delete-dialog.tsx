"use client";

import { useTranslations } from "next-intl";
import { SpinnerIcon, TrashIcon } from "@phosphor-icons/react";
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

type DeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  // Set when confirming a bulk delete from the table's multi-select
  // toolbar (transactions-view.tsx) — swaps in the count-aware title/
  // description instead of the singular one-transaction copy. Absent
  // (the default) for the single-row delete flow.
  count?: number;
};

export function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  count,
}: DeleteDialogProps) {
  const t = useTranslations("scrn-transactions");
  const isBulk = count !== undefined;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <TrashIcon aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {isBulk
              ? t("dialog.delete.titleBulk", { count })
              : t("dialog.delete.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk
              ? t("dialog.delete.descriptionBulk", { count })
              : t("dialog.delete.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} className="h-11 sm:h-9">
            {t("dialog.delete.cancel")}
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
            {t("dialog.delete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
