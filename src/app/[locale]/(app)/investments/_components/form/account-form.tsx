"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useZodForm } from "@/lib/form/use-zod-form";
import { FormError } from "@/components/form/form-error";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import {
  investmentAccountSchema,
  investmentAccountTypeValues,
  emptyInvestmentAccountFormValues,
  type InvestmentAccountFormValues,
  type InvestmentAccountTypeOption,
} from "../../_schema/schema";
import type { InvestmentAccountRow } from "../../_types/types";

function toFormValues(
  row: InvestmentAccountRow | null,
  defaultType: InvestmentAccountTypeOption | undefined,
): InvestmentAccountFormValues {
  if (!row) {
    return defaultType
      ? { ...emptyInvestmentAccountFormValues, type: defaultType }
      : emptyInvestmentAccountFormValues;
  }

  return {
    name: row.name,
    type: row.type as InvestmentAccountFormValues["type"],
  };
}

type AccountFormProps = {
  isEditing: boolean;
  initialValues: InvestmentAccountRow | null;
  // Which type to preselect when creating from a specific section's "add"
  // tile (investments-view.tsx) — ignored once initialValues (edit mode)
  // is set.
  defaultType?: InvestmentAccountTypeOption;
  onSubmit: (
    values: InvestmentAccountFormValues,
  ) => Promise<{ error: string | null }>;
  onSuccess: () => void;
};

export function AccountForm({
  isEditing,
  initialValues,
  defaultType,
  onSubmit,
  onSuccess,
}: AccountFormProps) {
  const t = useTranslations("scrn-investments");
  const tCommon = useTranslations("common");
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useZodForm(investmentAccountSchema, {
    defaultValues: toFormValues(initialValues, defaultType),
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <form.AppField name="name">
        {(field) => (
          <field.TextField
            label={t("fields.name.label")}
            placeholder={t("fields.name.placeholder")}
          />
        )}
      </form.AppField>

      <form.AppField name="type">
        {(field) => (
          <field.SelectField
            label={t("fields.type.label")}
            placeholder={t("fields.type.label")}
            options={investmentAccountTypeValues.map((type) => ({
              value: type,
              label: t(`fields.type.${type.toLowerCase()}`),
            }))}
          />
        )}
      </form.AppField>

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
