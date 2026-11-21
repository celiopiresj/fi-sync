"use client";

import { useTranslations } from "next-intl";
import { SpinnerIcon, TrashIcon, WarningCircleIcon } from "@phosphor-icons/react";
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
  personName: string;
  // How many TransactionSplit rows point at the person being considered
  // for deletion — deleting would cascade-remove those (see
  // prisma/schema.prisma, TransactionSplit.person onDelete: Cascade), so
  // > 0 replaces the usual confirm dialog with a blocking explanation
  // instead of letting the user proceed (deletePerson enforces this
  // server-side too, this is just so the UI doesn't even offer it).
  linkedSplitsCount: number;
};

export function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  personName,
  linkedSplitsCount,
}: DeleteDialogProps) {
  const t = useTranslations("scrn-people");
  const canDelete = linkedSplitsCount === 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia
            className={
              canDelete
                ? "bg-destructive/10 text-destructive"
                : "bg-warning/10 text-warning"
            }
          >
            {canDelete ? (
              <TrashIcon aria-hidden="true" />
            ) : (
              <WarningCircleIcon aria-hidden="true" />
            )}
          </AlertDialogMedia>
          <AlertDialogTitle className="break-words">
            {t(canDelete ? "dialog.delete.title" : "dialog.deleteBlocked.title", {
              name: personName,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {canDelete
              ? t("dialog.delete.description")
              : t("errors.hasSplits", { count: linkedSplitsCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {canDelete ? (
            <>
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
                {t(isPending ? "dialog.delete.pending" : "dialog.delete.confirm")}
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogCancel className="h-11 sm:h-9">
              {t("dialog.deleteBlocked.close")}
            </AlertDialogCancel>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
