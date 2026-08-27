"use client";

import { useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { FormError } from "@/components/form/form-error";
import { useZodForm } from "@/lib/form/use-zod-form";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import { todayCalendarDate } from "@/lib/date";
import {
  payInvoiceSchema,
  refinePayInvoice,
  emptyPayInvoiceFormValues,
  type PayInvoiceFormValues,
} from "../../_schema/schema";
import { payInvoice } from "../../actions";
import { useInvoicePeopleOwed } from "../../_hooks/use-invoice-people-owed";
import type { PayableAccountOption } from "../../_types/types";

type PayInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  remainingDue: number;
  accounts: PayableAccountOption[];
  onPaid: () => void;
};

// Same "cents beat float comparison" reasoning as debit-transaction-
// form.tsx's own toCents/centsToAmountString.
function toCents(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function centsToAmountString(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function PayInvoiceDialog({
  open,
  onOpenChange,
  invoiceId,
  remainingDue,
  accounts,
  onPaid,
}: PayInvoiceDialogProps) {
  const t = useTranslations("scrn-invoices");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("common.validation");
  const format = useFormatter();
  const [serverError, setServerError] = useState<string | null>(null);

  const peopleOwed = useInvoicePeopleOwed(invoiceId, open);
  const remainingDueCents = Math.round(remainingDue * 100);

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  const schema = useMemo(
    () =>
      payInvoiceSchema.superRefine((value, ctx) =>
        refinePayInvoice(value, ctx, {
          remainingDueCents,
          messages: {
            allocationsRequired: tValidation("required"),
            allocationsMismatch: t("detail.markPaid.allocations.mismatch"),
          },
        }),
      ),
    [remainingDueCents, t, tValidation],
  );

  const form = useZodForm(schema, {
    defaultValues: {
      ...emptyPayInvoiceFormValues,
      paidAmount: centsToAmountString(remainingDueCents),
      paidAt: todayCalendarDate(),
    } as PayInvoiceFormValues,
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const result = await payInvoice(invoiceId, value);
        if (result?.error) {
          setServerError(result.error);
          return;
        }
        toast.success(t("toast.paymentRegistered"));
        onOpenChange(false);
        onPaid();
      } catch (err) {
        if (isNextRedirectError(err)) throw err;
        setServerError(tCommon("errorGeneric"));
      }
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const paidAmountValue = useStore(form.store, (state) => state.values.paidAmount);
  const allocations = useStore(form.store, (state) => state.values.allocations);

  const paidCents = toCents(paidAmountValue);
  const needsAllocation = paidCents !== remainingDueCents && paidCents > 0;
  const coveredCents = Math.min(paidCents, remainingDueCents);
  const overflowCents = Math.max(0, paidCents - remainingDueCents);

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

          {needsAllocation && (
            <div className="flex flex-col gap-3 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">
                  {t("detail.markPaid.allocations.toggleLabel")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("detail.markPaid.allocations.hint")}
                </p>
              </div>

              {overflowCents > 0 && (
                <p className="text-xs text-warning">
                  {t("detail.markPaid.allocations.overflowHint", {
                    value: money(overflowCents / 100),
                  })}
                </p>
              )}

              {peopleOwed.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("detail.markPaid.allocations.empty")}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {peopleOwed.map((person) => {
                    const index = allocations.findIndex(
                      (allocation) => allocation.personId === person.personId,
                    );
                    const checked = index !== -1;
                    return (
                      <div
                        key={person.personId}
                        className="flex flex-col gap-2 rounded-md border border-border/60 p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex min-w-0 items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => {
                                if (value) {
                                  form.pushFieldValue("allocations", {
                                    personId: person.personId,
                                    amount: centsToAmountString(
                                      Math.min(person.remainingCents, coveredCents),
                                    ),
                                  });
                                } else if (index !== -1) {
                                  form.removeFieldValue("allocations", index);
                                }
                              }}
                            />
                            <span className="min-w-0 truncate">{person.personName}</span>
                          </label>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {money(person.remainingCents / 100)}
                          </span>
                        </div>
                        {checked && (
                          <form.AppField name={`allocations[${index}].amount`}>
                            {(field) => (
                              <field.AmountField
                                label={t("detail.markPaid.allocations.amountLabel")}
                                placeholder="0,00"
                              />
                            )}
                          </form.AppField>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
