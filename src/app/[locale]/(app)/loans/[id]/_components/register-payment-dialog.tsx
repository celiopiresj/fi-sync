"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
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
  registerLoanPaymentSchema,
  emptyRegisterLoanPaymentFormValues,
} from "../../_schema/schema";
import { registerLoanPayment } from "../../actions";
import type { LoanAccountOption, LoanInstallmentRow } from "../../_types/types";

type RegisterPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: LoanInstallmentRow;
  accounts: LoanAccountOption[];
  onPaid: () => void;
};

export function RegisterPaymentDialog({
  open,
  onOpenChange,
  installment,
  accounts,
  onPaid,
}: RegisterPaymentDialogProps) {
  const t = useTranslations("scrn-loans");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [serverError, setServerError] = useState<string | null>(null);

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  const form = useZodForm(registerLoanPaymentSchema, {
    defaultValues: {
      ...emptyRegisterLoanPaymentFormValues,
      paidAt: todayCalendarDate(),
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const result = await registerLoanPayment(installment.id, value);
        if (result?.error) {
          setServerError(result.error);
          return;
        }
        toast.success(t("payment.toast.registered"));
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
          <DialogTitle>{t("payment.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("payment.dialog.description", {
              number: installment.installmentNumber,
              count: installment.installmentCount,
              amount: money(installment.amount),
            })}
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
          <form.AppField name="accountId">
            {(field) => (
              <field.SelectField
                label={t("payment.dialog.accountLabel")}
                placeholder={t("payment.dialog.accountPlaceholder")}
                options={accounts.map((account) => ({
                  value: account.id,
                  label: account.name,
                }))}
              />
            )}
          </form.AppField>

          <form.AppField name="paidAt">
            {(field) => <field.DateField label={t("payment.dialog.dateLabel")} />}
          </form.AppField>

          <FormError title={t("toast.error")} description={serverError} />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("payment.dialog.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <SpinnerIcon className="size-4 animate-spin" />}
              {t("payment.dialog.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
