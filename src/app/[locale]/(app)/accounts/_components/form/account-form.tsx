"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useZodForm } from "@/lib/form/use-zod-form";
import { FormError } from "@/components/form/form-error";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import {
  accountSchema,
  accountTypeValues,
  emptyAccountFormValues,
  type AccountFormValues,
  type AccountTypeOption,
} from "../../_schema/schema";
import type { AccountRow } from "../../_types/types";

function toFormValues(
  row: AccountRow | null,
  defaultType: AccountTypeOption | undefined,
): AccountFormValues {
  if (!row) {
    return defaultType
      ? { ...emptyAccountFormValues, type: defaultType }
      : emptyAccountFormValues;
  }

  return {
    name: row.name,
    type: row.type as AccountFormValues["type"],
  };
}

type AccountFormProps = {
  isEditing: boolean;
  initialValues: AccountRow | null;
  // Which type to preselect when creating from a specific section's "add"
  // tile (accounts-view.tsx) — ignored once initialValues (edit mode) is
  // set.
  defaultType?: AccountTypeOption;
  onSubmit: (values: AccountFormValues) => Promise<{ error: string | null }>;
  onSuccess: () => void;
};

export function AccountForm({
  isEditing,
  initialValues,
  defaultType,
  onSubmit,
  onSuccess,
}: AccountFormProps) {
  const t = useTranslations("scrn-accounts");
  const tCommon = useTranslations("common");
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useZodForm(accountSchema, {
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
            options={accountTypeValues.map((type) => ({
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
