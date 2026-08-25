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
  linkedSplitsCount,
}: DeleteDialogProps) {
  const t = useTranslations("scrn-people");
  const canDelete = linkedSplitsCount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("aria.close")}>
        <DialogHeader>
          <DialogTitle>
            {t(canDelete ? "dialog.delete.title" : "dialog.deleteBlocked.title")}
          </DialogTitle>
          <DialogDescription>
            {canDelete
              ? t("dialog.delete.description")
              : t("errors.hasSplits", { count: linkedSplitsCount })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {canDelete ? (
            <>
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
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("dialog.deleteBlocked.close")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
