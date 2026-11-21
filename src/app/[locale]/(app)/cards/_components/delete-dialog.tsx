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
  cardName: string;
};

export function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  cardName,
}: DeleteDialogProps) {
  const t = useTranslations("scrn-cards");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <TrashIcon aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle className="break-words">
            {t("dialog.delete.title", { name: cardName })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("dialog.delete.description")}
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
            {t(isPending ? "dialog.delete.confirming" : "dialog.delete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
