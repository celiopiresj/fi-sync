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

// Local to this route (mirrors accounts/_components/delete-dialog.tsx)
// rather than a shared component — the confirm copy lives in this
// screen's own scrn-cards namespace (AGENTS.md's i18n convention).
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
  const t = useTranslations("scrn-cards");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("aria.close")}>
        <DialogHeader>
          <DialogTitle>{t("dialog.delete.title")}</DialogTitle>
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
