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

// Local to this route (mirrors transactions/_components/delete-dialog.tsx)
// rather than a shared component, since the two screens' confirm copy
// lives in different scrn-* namespaces — see AGENTS.md's i18n convention.
// An AlertDialog (not a plain Dialog): deleting an account also deletes
// its transactions, so the title names the account, the description
// states that consequence and the hint points to archiving, the
// non-destructive alternative.
type DeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  accountName: string;
};

export function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  accountName,
}: DeleteDialogProps) {
  const t = useTranslations("scrn-accounts");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <TrashIcon />
          </AlertDialogMedia>
          <AlertDialogTitle className="break-words">
            {t("dialog.delete.title", { name: accountName })}
          </AlertDialogTitle>
          <AlertDialogDescription className="flex flex-col gap-2">
            <span>{t("dialog.delete.description")}</span>
            <span>{t("dialog.delete.hint")}</span>
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
              // Keep the dialog open while the delete runs; the view
              // closes it once the action resolves.
              event.preventDefault();
              onConfirm();
            }}
          >
            {isPending && <SpinnerIcon className="animate-spin" />}
            {t(isPending ? "dialog.delete.confirming" : "dialog.delete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
