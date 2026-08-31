"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useStore } from "@tanstack/react-form";
import { useZodForm } from "@/lib/form/use-zod-form";
import { FormError } from "@/components/form/form-error";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import { dateOnlyKey } from "@/lib/date";
import { ItemGroup } from "@/components/ui/item";
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

function toFormValues(loan: LoanFormPrefill | null): LoanFormValues {
  if (!loan) return emptyLoanFormValues;

  return {
    personId: loan.personId,
    description: loan.description,
    installmentAmount: loan.installmentAmount.toFixed(2).replace(".", ","),
    installments: String(loan.installmentCount),
    dueDate: dateOnlyKey(loan.dueDate),
    receivedAmount: "",
    receivedAccountId: "",
  };
}

type LoanFormProps = {
  isEditing: boolean;
  initialValues: LoanFormPrefill | null;
  people: LoanPersonOption[];
  accounts: LoanAccountOption[];
  onSubmit: (values: LoanFormValues) => Promise<{ error: string | null }>;
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

  const schema = loanSchema.superRefine((value: LoanValues, ctx) =>
    refineLoanReceived(value, ctx, {
      accountRequired: tValidation("required"),
    }),
  );

  const form = useZodForm(schema, {
    defaultValues: toFormValues(initialValues),
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const result = await onSubmit(value);
        if (result?.error) {
          setServerError(result.error);
        } else {
          onSuccess();
        }
      } catch (err) {
        if (isNextRedirectError(err)) throw err;
        setServerError(tCommon("errorGeneric"));
      }
    },
  });

  const receivedAmountValue = useStore(
    form.store,
    (state) => state.values.receivedAmount,
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
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

      <ItemGroup className="gap-0 divide-y rounded-md border border-border">
        <form.AppField name="dueDate">
          {(field) => (
            <field.DatePickerRowField
              label={t("fields.dueDate.label")}
              placeholder={t("fields.choosePlaceholder")}
              formatDisplay={(date) =>
                format.dateTime(date, { dateStyle: "long" })
              }
            />
          )}
        </form.AppField>

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
    </form>
  );
}
