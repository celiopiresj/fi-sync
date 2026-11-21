"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useZodForm } from "@/lib/form/use-zod-form";
import { FormError } from "@/components/form/form-error";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import {
  personSchema,
  refinePerson,
  emptyPersonFormValues,
  type PersonFormValues,
} from "../../_schema/schema";
import { joinPersonPhone } from "../../_lib/phone";
import { ColorPicker, AVAILABLE_COLORS } from "@/components/form/color-picker";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PersonRow } from "../../_types/types";

function toFormValues(row: PersonRow | null): PersonFormValues {
  if (!row) return emptyPersonFormValues;
  return {
    name: row.name,
    phone: joinPersonPhone(row.phoneCountryCode, row.phone) ?? "",
    colorStyle: row.colorStyle ?? AVAILABLE_COLORS[0].class,
    includeInBudget: row.includeInBudget,
  };
}

type PersonFormProps = {
  isEditing: boolean;
  initialValues: PersonRow | null;
  onSubmit: (values: PersonFormValues) => Promise<{ error: string | null }>;
  onSuccess: () => void;
};

export function PersonForm({
  isEditing,
  initialValues,
  onSubmit,
  onSuccess,
}: PersonFormProps) {
  const t = useTranslations("scrn-people");
  const tCommon = useTranslations("common");
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      personSchema.superRefine((value, ctx) =>
        refinePerson(value, ctx, {
          messages: { invalidPhone: t("errors.invalidPhone") },
        }),
      ),
    [t],
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex min-h-full flex-col gap-4"
    >
      <div className="flex flex-1 flex-col gap-4">
        <form.AppField name="name">
          {(field) => (
            <field.TextField
              label={t("fields.name.label")}
              placeholder={t("fields.name.placeholder")}
            />
          )}
        </form.AppField>

        <form.AppField name="phone">
          {(field) => (
            <field.PhoneField
              label={t("fields.phone.label")}
              placeholder={t("fields.phone.placeholder")}
              defaultCountry="BR"
            />
          )}
        </form.AppField>

        <form.Field name="colorStyle">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <span id="person-color-label" className="text-sm font-medium">
                {t("fields.color.label")}
              </span>
              <ColorPicker
                ariaLabelledBy="person-color-label"
                value={field.state.value}
                onChange={(val) => field.handleChange(val)}
              />
            </div>
          )}
        </form.Field>

        {/* Meaningless on the self ("Eu") person — self always counts
            toward the budget regardless of this flag (see Person's own
            comment in prisma/schema.prisma), so the toggle only makes
            sense for anyone else. */}
        {!initialValues?.isSelf && (
          <form.Field name="includeInBudget">
            {(field) => (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 p-3">
                <div className="flex flex-col gap-0.5">
                  <Label
                    htmlFor="person-include-in-budget"
                    className="text-sm font-medium"
                  >
                    {t("fields.includeInBudget.label")}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {t("fields.includeInBudget.help")}
                  </span>
                </div>
                <Switch
                  id="person-include-in-budget"
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
              </div>
            )}
          </form.Field>
        )}

        <FormError title={t("toast.error")} description={serverError} />
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-border/60 bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form.AppForm>
          <form.SubmitButton
            className="w-full"
            label={t(isEditing ? "dialog.edit.confirm" : "dialog.create.confirm")}
            submittingLabel={t(
              isEditing ? "dialog.edit.submitting" : "dialog.create.submitting",
            )}
          />
        </form.AppForm>
      </div>
    </form>
  );
}
