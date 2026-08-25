"use client";

import { FormError } from "@/components/form/form-error";
import { useZodForm } from "@/lib/form/use-zod-form";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  categorySchema,
  emptyCategoryFormValues,
  type CategoryFormValues,
} from "../../_schema/schema";
import type { CategoryRow } from "../../_types/types";
import {
  CategoryColorPicker,
  CategoryIconPicker,
  CategoryPreviewCard,
  CategoryTypeSelector,
} from "./category-selectors";

function toFormValues(row: CategoryRow | null): CategoryFormValues {
  if (!row) {
    return emptyCategoryFormValues;
  }
  return {
    name: row.name,
    type: row.type,
    colorStyle: row.colorStyle,
    icon: row.icon,
  };
}

type CategoryFormProps = {
  isEditing: boolean;
  initialValues: CategoryRow | null;
  onSubmit: (values: CategoryFormValues) => Promise<{ error: string | null }>;
  onSuccess: () => void;
};

export function CategoryForm({
  isEditing,
  initialValues,
  onSubmit,
  onSuccess,
}: CategoryFormProps) {
  const t = useTranslations("scrn-categories");
  const tCommon = useTranslations("common");
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useZodForm(categorySchema, {
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

  const isSystem = initialValues?.userId === null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-6">
      <form.Subscribe selector={(state) => state.values}>
        {(currentValues) => (
          <CategoryPreviewCard
            name={currentValues.name}
            type={currentValues.type}
            icon={currentValues.icon}
            colorStyle={currentValues.colorStyle}
            isSystem={isSystem}
          />
        )}
      </form.Subscribe>

      <form.AppField name="name">
        {(field) => (
          <field.TextField
            label={t("fields.name.label")}
            placeholder={t("fields.name.placeholder")}
            disabled={isSystem}
          />
        )}
      </form.AppField>

      {!isSystem && (
        <>
          <form.Field name="type">
            {(field) => (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  {t("fields.type.label")}
                </label>
                <CategoryTypeSelector
                  value={field.state.value}
                  onChange={(val) => field.handleChange(val)}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="colorStyle">
            {(field) => (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  {t("fields.color.label")}
                </label>
                <CategoryColorPicker
                  value={field.state.value}
                  onChange={(val) => field.handleChange(val)}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="icon">
            {(field) => (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  {t("fields.icon.label")}
                </label>
                <CategoryIconPicker
                  value={field.state.value}
                  onChange={(val) => field.handleChange(val)}
                />
              </div>
            )}
          </form.Field>
        </>
      )}

      <FormError title={t("toast.error")} description={serverError} />

      {!isSystem && (
        <form.AppForm>
          <form.SubmitButton
            label={t(
              isEditing ? "dialog.edit.confirm" : "dialog.create.confirm",
            )}
            submittingLabel={t(
              isEditing ? "dialog.edit.confirm" : "dialog.create.confirm",
            )}
          />
        </form.AppForm>
      )}
    </form>
  );
}
