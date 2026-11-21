"use client";

import { FormError } from "@/components/form/form-error";
import { useZodForm } from "@/lib/form/use-zod-form";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  accountSchema,
  accountToFormValues,
  accountTypeValues,
  type AccountFormValues,
  type AccountTypeOption,
} from "../../_schema/schema";
import type { AccountRow } from "../../_types/types";

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
    defaultValues: accountToFormValues(initialValues, defaultType),
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
      className="flex min-h-full flex-col gap-4">
      <div className="flex flex-1 flex-col gap-4">
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

        <form.AppField name="initialBalance">
          {(field) => (
            <field.AmountField
              label={t("fields.initialBalance.label")}
              placeholder={t("fields.initialBalance.placeholder")}
              footer={
                <p className="text-xs text-muted-foreground">
                  {t(
                    isEditing
                      ? "fields.initialBalance.hintEdit"
                      : "fields.initialBalance.hint",
                  )}
                </p>
              }
            />
          )}
        </form.AppField>

        <FormError title={t("toast.error")} description={serverError} />
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-border/60 bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form.AppForm>
          <form.SubmitButton
            className="w-full"
            label={t(
              isEditing ? "dialog.edit.confirm" : "dialog.create.confirm",
            )}
            submittingLabel={t(
              isEditing ? "dialog.edit.submitting" : "dialog.create.submitting",
            )}
          />
        </form.AppForm>
      </div>
    </form>
  );
}
