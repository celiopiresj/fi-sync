"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TrashIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

type DeleteInstallmentScopeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installmentNumber: number;
  installmentCount: number;
  isPending: boolean;
  onChooseScope: (scope: "this" | "all") => void;
};

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <TrashIcon aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {t("dialog.deleteInstallmentScope.title", {
              number: installmentNumber,
              total: installmentCount,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("dialog.deleteInstallmentScope.description", {
              total: installmentCount,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="outline"
            className="h-11 w-full sm:h-9"
            disabled={isPending}
            onClick={() => onChooseScope("this")}>
            {t("dialog.deleteInstallmentScope.this")}
          </Button>
          <Button
            variant="destructive"
            className="h-11 w-full sm:h-9"
            disabled={isPending}
            onClick={() => onChooseScope("all")}>
            {t("dialog.deleteInstallmentScope.all", {
              total: installmentCount,
            })}
          </Button>
          <AlertDialogCancel
            className="h-11 w-full sm:h-9"
            disabled={isPending}>
            {t("dialog.deleteInstallmentScope.cancel")}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
