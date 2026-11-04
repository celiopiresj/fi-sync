"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ExistingDialogProps } from "../_types/types";

export function ExistingDialog({ preview }: ExistingDialogProps) {
  const t = useTranslations("scrn-open-finance");
  const unlinked = preview.selectedCount - preview.selectedLinkedCount;
  return <AlertDialog open={preview.confirmingExisting} onOpenChange={(open) => { if (!preview.marking) preview.setConfirmingExisting(open); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("dialog.existing.title")}</AlertDialogTitle>
        <AlertDialogDescription>{t("dialog.existing.description")}</AlertDialogDescription>
      </AlertDialogHeader>
      <ul className="flex flex-col gap-1 text-sm">
        <li className="text-positive">{t("dialog.existing.linked", { count: preview.selectedLinkedCount })}</li>
        <li className={unlinked > 0 ? "text-warning" : "text-muted-foreground"}>{t("dialog.existing.unlinked", { count: unlinked })}</li>
      </ul>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={preview.marking}>{t("dialog.existing.cancel")}</AlertDialogCancel>
        <AlertDialogAction disabled={preview.marking} onClick={(event) => { event.preventDefault(); preview.confirmExisting(); }}>{t("dialog.existing.confirm")}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
