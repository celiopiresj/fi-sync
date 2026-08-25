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

type WhatsAppPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  whatsappLink: string;
};

export function WhatsAppPreviewDialog({
  open,
  onOpenChange,
  message,
  whatsappLink,
}: WhatsAppPreviewDialogProps) {
  const t = useTranslations("scrn-people");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("aria.close")}>
        <DialogHeader>
          <DialogTitle>{t("detail.whatsapp.previewTitle")}</DialogTitle>
          <DialogDescription>
            {t("detail.whatsapp.previewDescription")}
          </DialogDescription>
        </DialogHeader>

        <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-surface-1 p-3 text-sm">
          {message}
        </pre>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("detail.whatsapp.cancel")}
          </Button>
          <Button asChild onClick={() => onOpenChange(false)}>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              {t("detail.whatsapp.send")}
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
