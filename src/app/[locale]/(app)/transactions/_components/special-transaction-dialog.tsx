"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SpecialTransactionKind } from "../_lib/special-transaction";

type SpecialTransactionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  special: SpecialTransactionKind | null;
};

// Stands in for the normal debit/credit edit sheet whenever the row
// being "edited" is actually the tracked side effect of a different
// screen's own action (see resolveSpecialTransactionKind's own comment)
// — explains what the row is instead of opening a form that would let
// the user desync it, and links straight to the screen that actually
// owns it.
export function SpecialTransactionDialog({
  open,
  onOpenChange,
  special,
}: SpecialTransactionDialogProps) {
  const t = useTranslations("scrn-transactions.dialog.special");

  if (!special) return null;

  // Null for a transfer leg — no screen owns it (see
  // resolveSpecialTransactionKind's own comment), so the dialog only
  // explains and closes.
  const href =
    special.kind === "initialBalance"
      ? "/accounts"
      : special.kind === "investmentMovement"
        ? `/investments/${special.accountId}`
        : special.kind === "loanInstallment"
          ? `/loans/${special.loanId}`
          : special.kind === "invoicePayment"
            ? `/invoices/${special.invoiceId}`
            : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t(`${special.kind}.title`)}</DialogTitle>
          <DialogDescription>
            {t(`${special.kind}.description`)}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
          {href && (
            <Button asChild onClick={() => onOpenChange(false)}>
              <Link href={href}>{t(`${special.kind}.goTo`)}</Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
