"use client";

import { useMemo, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useStore } from "@tanstack/react-form";
import { toast } from "sonner";
import { InfoIcon, SpinnerIcon } from "@phosphor-icons/react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FormError } from "@/components/form/form-error";
import { useZodForm } from "@/lib/form/use-zod-form";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import { todayCalendarDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  payInvoiceSchema,
  refinePayInvoice,
  emptyPayInvoiceFormValues,
  type PayInvoiceFormValues,
} from "../../_schema/schema";
import { payInvoice } from "../../actions";
import { useInvoicePeopleOwed } from "../../_hooks/use-invoice-people-owed";
import {
  amountStringToCents,
  centsToAmountString,
  distributeAllocations,
} from "../_lib/allocations";
import type { PayableAccountOption } from "../../_types/types";

type PayInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  remainingDue: number;
  accounts: PayableAccountOption[];
  onPaid: () => void;
};

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
  // People whose amount the user typed by hand — kept as typed while
  // everyone else is redistributed around them (distributeAllocations).
  const [manualIds, setManualIds] = useState<Set<string>>(new Set());

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
      accountId: accounts.find((account) => account.isDefault)?.id ?? "",
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

  const submissionAttempts = useStore(form.store, (state) => state.submissionAttempts);

  const paidCents = amountStringToCents(paidAmountValue);
  const needsAllocation = paidCents !== remainingDueCents && paidCents > 0;
  const coveredCents = Math.min(paidCents, remainingDueCents);
  const overflowCents = Math.max(0, paidCents - remainingDueCents);
  const selectedIds = allocations.map((allocation) => allocation.personId);
  const allocatedCents = allocations.reduce(
    (sum, allocation) => sum + amountStringToCents(allocation.amount),
    0,
  );
  // Positive = still to split, negative = split over. Same 1-cent
  // tolerance as refinePayInvoice.
  const missingCents = coveredCents - allocatedCents;

  // Recomputes every automatic share after the selection, the paid
  // amount or a hand-typed amount changes. Hand-typed entries keep the
  // user's own string (re-formatting it mid-typing would fight them).
  function redistribute(nextSelectedIds: string[], manual: Set<string>, covered: number) {
    const current = form.state.values.allocations;
    const shares = distributeAllocations(
      covered,
      nextSelectedIds.map((personId) => {
        const existing = current.find((allocation) => allocation.personId === personId);
        return {
          personId,
          remainingCents:
            peopleOwed.find((person) => person.personId === personId)?.remainingCents ?? 0,
          manualCents:
            manual.has(personId) && existing ? amountStringToCents(existing.amount) : null,
        };
      }),
    );
    form.setFieldValue(
      "allocations",
      shares.map((share) => {
        const existing = current.find((allocation) => allocation.personId === share.personId);
        return {
          personId: share.personId,
          amount:
            manual.has(share.personId) && existing
              ? existing.amount
              : centsToAmountString(share.cents),
        };
      }),
      // A programmatic rewrite must not count as the user typing an
      // amount (handleManualAmount listens to those fields).
      { dontRunListeners: true },
    );
  }

  function handleTogglePerson(personId: string, checked: boolean) {
    const nextManual = new Set(manualIds);
    if (!checked) nextManual.delete(personId);
    setManualIds(nextManual);
    redistribute(
      checked ? [...selectedIds, personId] : selectedIds.filter((id) => id !== personId),
      nextManual,
      coveredCents,
    );
  }

  function handleManualAmount(personId: string) {
    const nextManual = new Set(manualIds).add(personId);
    setManualIds(nextManual);
    redistribute(selectedIds, nextManual, coveredCents);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* DialogContent caps its height (max-h-[85vh]); with many people
          owing on the invoice the "Dividir entre pessoas" list used to
          spill past it, hiding the confirm button. The min-h-0 chain
          below lets only that list shrink and scroll, keeping the
          fields and the footer always in view. */}
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
          className="flex min-h-0 flex-col gap-4"
        >
          <form.AppField
            name="paidAmount"
            listeners={{
              onChange: ({ value }) =>
                redistribute(
                  selectedIds,
                  manualIds,
                  Math.min(amountStringToCents(String(value)), remainingDueCents),
                ),
            }}
          >
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
            <div className="flex min-h-0 flex-col gap-3 rounded-md border border-border p-3">
              {/* The explanation lives behind the "i" so the list of people
                  keeps the room — the dialog's height is capped. */}
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium">
                  {t("detail.markPaid.allocations.toggleLabel")}
                </p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("detail.markPaid.allocations.infoAria")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <InfoIcon className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="flex-col items-start">
                      <p>{t("detail.markPaid.allocations.hint")}</p>
                      <p>{t("detail.markPaid.allocations.autoHint")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                <div className="-mr-1 flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
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
                              onCheckedChange={(value) =>
                                handleTogglePerson(person.personId, value === true)
                              }
                            />
                            <span className="min-w-0 truncate">{person.personName}</span>
                          </label>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {money(person.remainingCents / 100)}
                          </span>
                        </div>
                        {checked && (
                          <form.AppField
                            name={`allocations[${index}].amount`}
                            listeners={{ onChange: () => handleManualAmount(person.personId) }}
                          >
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

          {needsAllocation && peopleOwed.length > 0 && (
            // Live "does it add up" line — and, once a submit was tried,
            // the reason it was blocked (the schema's own error sits on
            // `allocations`, which has no field of its own to show it).
            <p
              className={cn(
                "text-xs font-medium",
                allocations.length === 0
                  ? submissionAttempts > 0
                    ? "text-negative"
                    : "text-muted-foreground"
                  : missingCents > 1
                    ? submissionAttempts > 0
                      ? "text-negative"
                      : "text-warning"
                    : missingCents < -1
                      ? "text-negative"
                      : "text-positive",
              )}
            >
              {allocations.length === 0
                ? t("detail.markPaid.allocations.noneSelected")
                : missingCents > 1
                  ? t("detail.markPaid.allocations.missing", {
                      value: money(missingCents / 100),
                    })
                  : missingCents < -1
                    ? t("detail.markPaid.allocations.excess", {
                        value: money(-missingCents / 100),
                      })
                    : t("detail.markPaid.allocations.summary", {
                        allocated: money(allocatedCents / 100),
                        total: money(coveredCents / 100),
                      })}
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
