"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useStore } from "@tanstack/react-form";
import { toast } from "sonner";
import { SpinnerIcon } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form/form-error";
import { useZodForm } from "@/lib/form/use-zod-form";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import {
  editPaymentDateSchema,
  type EditPaymentDateFormValues,
} from "../../_schema/schema";
import { updateInvoicePaymentDate } from "../../actions";

type EditPaymentDateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string;
  currentPaidAt: string;
  onUpdated: () => void;
};

// Only the payment's own date is editable here (see editPaymentDateSchema's
// own comment) — a much smaller dialog than PayInvoiceDialog on purpose,
// since amount/account/who-it-settled are already locked in by the time a
// payment exists.
export function EditPaymentDateDialog({
  open,
  onOpenChange,
  paymentId,
  currentPaidAt,
  onUpdated,
}: EditPaymentDateDialogProps) {
  const t = useTranslations("scrn-invoices");
  const tCommon = useTranslations("common");
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useZodForm(editPaymentDateSchema, {
    defaultValues: { paidAt: currentPaidAt } as EditPaymentDateFormValues,
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const result = await updateInvoicePaymentDate(paymentId, value.paidAt);
        if (result?.error) {
          setServerError(result.error);
          return;
        }
        toast.success(t("detail.payments.editDate.toast"));
        onOpenChange(false);
        onUpdated();
      } catch (err) {
        if (isNextRedirectError(err)) throw err;
        setServerError(tCommon("errorGeneric"));
      }
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("aria.close")}>
        <DialogHeader>
          <DialogTitle>{t("detail.payments.editDate.title")}</DialogTitle>
          <DialogDescription>
            {t("detail.payments.editDate.description")}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <form.AppField name="paidAt">
            {(field) => (
              <field.DateField label={t("detail.payments.editDate.dateLabel")} />
            )}
          </form.AppField>

          <FormError title={t("toast.error")} description={serverError} />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("detail.payments.editDate.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <SpinnerIcon className="size-4 animate-spin" />}
              {t("detail.payments.editDate.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
