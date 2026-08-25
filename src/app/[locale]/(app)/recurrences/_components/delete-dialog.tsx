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

type DeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
};

export function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: DeleteDialogProps) {
  const t = useTranslations("scrn-recurrences");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("aria.close")}>
        <DialogHeader>
          <DialogTitle>{t("dialog.delete.title")}</DialogTitle>
          {/* Cascade warning (future/pending occurrences are deleted
              too — see deleteRecurrence in actions.ts) lives in this one
              string; no bulk/count variant needed here, unlike
              transactions' delete-dialog.tsx — this screen has no
              multi-select. */}
          <DialogDescription>{t("dialog.delete.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("dialog.delete.cancel")}
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
            {t("dialog.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
