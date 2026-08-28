"use client";

import { useTranslations, useFormatter } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DATE_ONLY_FORMAT_OPTIONS } from "@/lib/date";

type PastInstallmentsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firstDueDate: Date;
  totalInstallments: number;
  upcomingInstallments: number;
  isSubmitting: boolean;
  onAddAll: () => void;
  onAddUpcoming: () => void;
};

// Shown by CreditTransactionForm right before submit when an
// installment purchase's first due date has already passed (see
// previewInstallmentCycles, transactions/actions.ts) — lets the user
// choose between creating every installment (including the already-due
// ones) or only the ones still ahead, instead of silently backdating a
// pile of already-late charges.
export function PastInstallmentsDialog({
  open,
  onOpenChange,
  firstDueDate,
  totalInstallments,
  upcomingInstallments,
  isSubmitting,
  onAddAll,
  onAddUpcoming,
}: PastInstallmentsDialogProps) {
  const t = useTranslations("scrn-transactions");
  const format = useFormatter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("aria.close")}>
        <DialogHeader>
          <DialogTitle>{t("dialog.pastInstallments.title")}</DialogTitle>
          <DialogDescription>
            {t("dialog.pastInstallments.description", {
              dueDate: format.dateTime(firstDueDate, DATE_ONLY_FORMAT_OPTIONS),
              total: totalInstallments,
              upcoming: upcomingInstallments,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {t("dialog.pastInstallments.cancel")}
          </Button>
          <Button
            variant="secondary"
            disabled={isSubmitting || upcomingInstallments === 0}
            onClick={onAddUpcoming}
          >
            {t("dialog.pastInstallments.addUpcoming")}
          </Button>
          <Button disabled={isSubmitting} onClick={onAddAll}>
            {t("dialog.pastInstallments.addAll")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
