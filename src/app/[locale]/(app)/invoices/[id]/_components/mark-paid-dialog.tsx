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
import { todayCalendarDate } from "@/lib/date";
import {
  markInvoicePaidSchema,
  type MarkInvoicePaidFormValues,
} from "../../_schema/schema";
import { markInvoicePaid } from "../../actions";
import type { PayableAccountOption } from "../../_types/types";

type MarkPaidDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  defaultAmount: number;
  accounts: PayableAccountOption[];
  onPaid: () => void;
};

export function MarkPaidDialog({
  open,
  onOpenChange,
  invoiceId,
  defaultAmount,
  accounts,
  onPaid,
}: MarkPaidDialogProps) {
  const t = useTranslations("scrn-invoices");
  const tCommon = useTranslations("common");
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useZodForm(markInvoicePaidSchema, {
    defaultValues: {
      paidAmount: defaultAmount.toFixed(2).replace(".", ","),
      accountId: "",
      paidAt: todayCalendarDate(),
    } as MarkInvoicePaidFormValues,
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const result = await markInvoicePaid(invoiceId, value);
        if (result?.error) {
          setServerError(result.error);
          return;
        }
        toast.success(t("toast.paid"));
        onOpenChange(false);
        onPaid();
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
          <DialogTitle>{t("detail.markPaid.title")}</DialogTitle>
          <DialogDescription>{t("detail.markPaid.description")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <form.AppField name="paidAmount">
            {(field) => (
              <field.AmountField
                label={t("detail.markPaid.amountLabel")}
                placeholder={t("detail.markPaid.amountPlaceholder")}
              />
            )}
          </form.AppField>

          <form.AppField name="accountId">
            {(field) => (
              <field.SelectField
                label={t("detail.markPaid.accountLabel")}
                placeholder={t("detail.markPaid.accountPlaceholder")}
                options={accounts.map((account) => ({
                  value: account.id,
                  label: account.name,
                }))}
              />
            )}
          </form.AppField>

          <form.AppField name="paidAt">
            {(field) => (
              <field.DateField label={t("detail.markPaid.dateLabel")} />
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
              {t("detail.markPaid.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <SpinnerIcon className="size-4 animate-spin" />}
              {t("detail.markPaid.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
