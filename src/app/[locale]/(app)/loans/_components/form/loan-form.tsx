"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useStore } from "@tanstack/react-form";
import { useZodForm } from "@/lib/form/use-zod-form";
import { FormError } from "@/components/form/form-error";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import { dateOnlyKey, parseCalendarDate, todayCalendarDate } from "@/lib/date";
import { ItemGroup } from "@/components/ui/item";
import { computeLoanInstallmentDates } from "../../_lib/installment-dates";
import {
  loanSchema,
  refineLoanReceived,
  emptyLoanFormValues,
  type LoanFormValues,
  type LoanValues,
} from "../../_schema/schema";
import type {
  LoanAccountOption,
  LoanFormPrefill,
  LoanPersonOption,
} from "../../_types/types";
import { PastInstallmentsDialog } from "./past-installments-dialog";

function toFormValues(
  loan: LoanFormPrefill | null,
  defaultAccountId: string,
): LoanFormValues {
  if (!loan) return { ...emptyLoanFormValues, receivedAccountId: defaultAccountId };

  return {
    personId: loan.personId,
    description: loan.description,
    installmentAmount: loan.installmentAmount.toFixed(2).replace(".", ","),
    installments: String(loan.installmentCount),
    // Once some installments are already paid, `loan.dueDate` (the
    // FIRST installment's date) may already be history — the field
    // means "when should the next unpaid installment fall" in that
    // state instead, so it defaults from `nextDueDate` (the first still-
    // unpaid one, per listLoans) rather than the loan's own origin date.
    // nextDueDate is only ever null for a fully-settled loan, which
    // never reaches this form (loans-view.tsx doesn't offer editing for
    // it) — falling back to loan.dueDate here is just type-level
    // defensiveness, not an expected runtime path.
    dueDate: dateOnlyKey(loan.nextDueDate ?? loan.dueDate),
    receivedAmount: "",
    receivedAccountId: defaultAccountId,
  };
}

type LoanFormProps = {
  isEditing: boolean;
  initialValues: LoanFormPrefill | null;
  people: LoanPersonOption[];
  accounts: LoanAccountOption[];
  onSubmit: (
    values: LoanFormValues,
    options?: { skipPastInstallments?: boolean },
  ) => Promise<{ error: string | null }>;
  onSuccess: () => void;
};

export function LoanForm({
  isEditing,
  initialValues,
  people,
  accounts,
  onSubmit,
  onSuccess,
}: LoanFormProps) {
  const t = useTranslations("scrn-loans");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("common.validation");
  const format = useFormatter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pastInstallmentsValue, setPastInstallmentsValue] =
    useState<LoanFormValues | null>(null);

  // Some (but not all) installments are already paid — description/
  // amount/installment count/person are locked in this state (see
  // cascadeLoanDateShift's doc comment in actions.ts), only the
  // remaining schedule's date can move. `nextDueDate !== null` rules out
  // the fully-settled edge case (nothing left to reschedule), which
  // keeps going through the form's original full-edit UI below and
  // still gets rejected server-side by updateLoan's `cannotEditPaid`
  // check, exactly like before this feature existed — loans-view.tsx
  // doesn't hide "Editar" for a settled loan, so that path still needs
  // to render something.
  const hasPartialPayments =
    isEditing &&
    initialValues !== null &&
    initialValues.paidInstallmentCount > 0 &&
    initialValues.nextDueDate !== null;

  const schema = loanSchema.superRefine((value: LoanValues, ctx) =>
    refineLoanReceived(value, ctx, {
      accountRequired: tValidation("required"),
    }),
  );

  async function performSubmit(
    value: LoanFormValues,
    options?: { skipPastInstallments?: boolean },
  ) {
    setServerError(null);
    try {
      const result = await onSubmit(value, options);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      onSuccess();
    } catch (err) {
      if (isNextRedirectError(err)) throw err;
      setServerError(tCommon("errorGeneric"));
    }
  }

  const form = useZodForm(schema, {
    defaultValues: toFormValues(
      initialValues,
      accounts.find((account) => account.isDefault)?.id ?? "",
    ),
    onSubmit: async ({ value }) => {
      // The past-installments dialog only matters when a full schedule
      // is about to be (re)created from scratch (create, or full edit
      // with nothing paid yet) — a reschedule of already-existing unpaid
      // rows doesn't materialize anything new, so a past-dated anchor
      // here just means "this loan is now overdue," an already-supported
      // state (see listLoans' own overdueCount), not something to warn
      // about.
      if (!hasPartialPayments) {
        const installmentCount = Number(value.installments || "1");
        const dueDate = value.dueDate ? parseCalendarDate(value.dueDate) : null;
        if (dueDate && installmentCount > 0) {
          const [firstDueDate] = computeLoanInstallmentDates(dueDate, 1);
          if (firstDueDate < parseCalendarDate(todayCalendarDate())) {
            setPastInstallmentsValue(value);
            return;
          }
        }
      }
      await performSubmit(value);
    },
  });

  const receivedAmountValue = useStore(
    form.store,
    (state) => state.values.receivedAmount,
  );
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  // Only computed once the past-installments dialog is actually open —
  // recomputed off `pastInstallmentsValue` (the exact values that were
  // submitted), not the live form state, so the dialog's own counts
  // can't drift from what onAddAll/onAddUpcoming below actually submit.
  const pastInstallmentsCount = pastInstallmentsValue
    ? Number(pastInstallmentsValue.installments || "1")
    : 0;
  const pastInstallmentsDates = pastInstallmentsValue
    ? computeLoanInstallmentDates(
        parseCalendarDate(pastInstallmentsValue.dueDate),
        pastInstallmentsCount,
      )
    : [];
  const pastInstallmentsUpcomingCount = pastInstallmentsDates.filter(
    (date) => date >= parseCalendarDate(todayCalendarDate()),
  ).length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      {hasPartialPayments ? (
        <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          {t("fields.lockedNotice")}
        </p>
      ) : (
        <>
          <form.AppField name="description">
            {(field) => (
              <field.TextField
                label={t("fields.description.label")}
                placeholder={t("fields.description.placeholder")}
              />
            )}
          </form.AppField>

          <form.AppField name="installments">
            {(field) => (
              <field.TextField
                label={t("fields.installments.label")}
                placeholder={t("fields.installments.placeholder")}
              />
            )}
          </form.AppField>

          <form.AppField name="installmentAmount">
            {(field) => (
              <field.AmountField
                label={t("fields.installmentAmount.label")}
                placeholder="0,00"
              />
            )}
          </form.AppField>
        </>
      )}

      <ItemGroup className="gap-0 divide-y rounded-md border border-border">
        <form.AppField name="dueDate">
          {(field) => (
            <field.DatePickerRowField
              label={t(
                hasPartialPayments
                  ? "fields.dueDate.labelNextUnpaid"
                  : "fields.dueDate.label",
              )}
              placeholder={t("fields.choosePlaceholder")}
              formatDisplay={(date) =>
                format.dateTime(date, { dateStyle: "long" })
              }
            />
          )}
        </form.AppField>

        {/* Unlike description/installments/installmentAmount above,
            person stays editable even with paid installments — changing
            it retroactively relabels every real Transaction this loan
            has already produced (see syncLoanPersonToTransactions,
            actions.ts), not just future payments, so there's no "can't
            recompute what already happened" reason to lock it here. */}
        <form.AppField name="personId">
          {(field) => (
            <field.PickerRowField
              label={t("fields.person.label")}
              placeholder={t("fields.choosePlaceholder")}
              options={people.map((person) => ({
                value: person.id,
                label: person.name,
              }))}
            />
          )}
        </form.AppField>
      </ItemGroup>

      {/* Only relevant when creating — the disbursement, if any, already
          happened by the time an existing loan is edited. */}
      {!isEditing && (
        <div className="flex flex-col gap-4 rounded-md border border-dashed border-border p-3">
          <p className="text-xs text-muted-foreground">
            {t("fields.receivedAmount.hint")}
          </p>

          <form.AppField name="receivedAmount">
            {(field) => (
              <field.AmountField
                label={t("fields.receivedAmount.label")}
                placeholder="0,00"
              />
            )}
          </form.AppField>

          {receivedAmountValue ? (
            <form.AppField name="receivedAccountId">
              {(field) => (
                <field.SelectField
                  label={t("fields.receivedAccountId.label")}
                  placeholder={t("fields.receivedAccountId.placeholder")}
                  options={accounts.map((account) => ({
                    value: account.id,
                    label: account.name,
                  }))}
                />
              )}
            </form.AppField>
          ) : null}
        </div>
      )}

      <FormError title={t("toast.error")} description={serverError} />

      <form.AppForm>
        <form.SubmitButton
          label={t(isEditing ? "dialog.edit.confirm" : "dialog.create.confirm")}
          submittingLabel={t(
            isEditing ? "dialog.edit.confirm" : "dialog.create.confirm",
          )}
        />
      </form.AppForm>

      {pastInstallmentsValue && pastInstallmentsDates[0] && (
        <PastInstallmentsDialog
          open
          onOpenChange={(open) => {
            if (!open) setPastInstallmentsValue(null);
          }}
          firstDueDate={pastInstallmentsDates[0]}
          totalInstallments={pastInstallmentsCount}
          upcomingInstallments={pastInstallmentsUpcomingCount}
          isSubmitting={isSubmitting}
          onAddAll={async () => {
            await performSubmit(pastInstallmentsValue, { skipPastInstallments: false });
            setPastInstallmentsValue(null);
          }}
          onAddUpcoming={async () => {
            await performSubmit(pastInstallmentsValue, { skipPastInstallments: true });
            setPastInstallmentsValue(null);
          }}
        />
      )}
    </form>
  );
}
