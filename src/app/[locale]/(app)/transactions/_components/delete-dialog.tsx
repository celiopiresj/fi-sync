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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("aria.close")}>
        <DialogHeader>
          <DialogTitle>
            {isBulk ? t("dialog.delete.titleBulk", { count }) : t("dialog.delete.title")}
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? t("dialog.delete.descriptionBulk", { count })
              : t("dialog.delete.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("dialog.delete.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
          >
            {t("dialog.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
