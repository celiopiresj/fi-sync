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
import { cn } from "@/lib/utils";
import {
  registerLoanPaymentSchema,
  emptyRegisterLoanPaymentFormValues,
} from "../../_schema/schema";
import { classifyLoanPaymentAdjustment } from "../../_lib/loan-payment";
import { settleRemainingLoanInstallments } from "../../actions";
import type { LoanAccountOption } from "../../_types/types";

type SettleLoanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  pendingCount: number;
  remainingTotal: number;
  accounts: LoanAccountOption[];
  onSettled: (count: number) => void;
};

// Pays off every remaining installment of a loan in one shot ("quitação
// antecipada") — same field shape as RegisterPaymentDialog (account,
// date, the amount actually paid), except `paidAmount` here settles the
// whole remaining balance instead of one installment. The Server Action
// still creates one Transaction per installment (see
// settleRemainingLoanInstallments's own comment in actions.ts), so from
// undoLoanPayment's point of view a settled installment is
// indistinguishable from one paid on its own.
export function SettleLoanDialog({
  open,
  onOpenChange,
  loanId,
  pendingCount,
  remainingTotal,
  accounts,
  onSettled,
}: SettleLoanDialogProps) {
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
      // Prefilled to the nominal remaining balance — same reasoning as
      // RegisterPaymentDialog's own default.
      paidAmount: remainingTotal.toFixed(2).replace(".", ","),
      accountId: accounts.find((account) => account.isDefault)?.id ?? "",
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const result = await settleRemainingLoanInstallments(loanId, value);
        if (result.error) {
          setServerError(result.error);
          return;
        }
        toast.success(t("payment.toast.settled", { count: result.count }));
        onOpenChange(false);
        onSettled(result.count);
      } catch (err) {
        if (isNextRedirectError(err)) throw err;
        setServerError(tCommon("errorGeneric"));
      }
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const paidAmountValue = useStore(form.store, (state) => state.values.paidAmount);
  const adjustment = classifyLoanPaymentAdjustment(
    remainingTotal,
    Number(paidAmountValue.replace(",", ".")) || remainingTotal,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("aria.close")}>
        <DialogHeader>
          <DialogTitle>{t("payment.settle.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("payment.settle.dialog.description", {
              count: pendingCount,
              amount: money(remainingTotal),
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

          <form.AppField name="paidAmount">
            {(field) => (
              <field.AmountField
                label={t("payment.dialog.paidAmountLabel")}
                placeholder="0,00"
              />
            )}
          </form.AppField>

          {adjustment.type !== "none" && (
            <p
              className={cn(
                "text-xs font-medium",
                adjustment.type === "interest" ? "text-negative" : "text-positive",
              )}
            >
              {t(
                adjustment.type === "interest"
                  ? "payment.dialog.interestPreview"
                  : "payment.dialog.discountPreview",
                { amount: money(adjustment.amount) },
              )}
            </p>
          )}

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
              {t("payment.settle.dialog.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
