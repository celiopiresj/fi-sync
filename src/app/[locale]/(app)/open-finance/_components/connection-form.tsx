"use client";

import { useTranslations } from "next-intl";
import { useZodForm } from "@/lib/form/use-zod-form";
import { Button } from "@/components/ui/button";
import { useOpenFinanceMutations } from "../_hooks/use-open-finance";
import { connectionDefaults, connectionSchema } from "../_schema/schema";

export function ConnectionForm() {
  const t = useTranslations("scrn-open-finance");
  const { add } = useOpenFinanceMutations();
  const form = useZodForm(connectionSchema, { defaultValues: connectionDefaults, onSubmit: async ({ value }) => {
    const result = await add.mutateAsync(value);
    if (!result.error) form.reset();
  } });
  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void form.handleSubmit(); }}>
      <form.AppField name="label">{(field) => <field.TextField label={t("fields.label.label")} placeholder={t("fields.label.placeholder")} />}</form.AppField>
      <form.AppField name="itemId">{(field) => <field.TextField label={t("fields.itemId.label")} placeholder={t("fields.itemId.placeholder")} />}</form.AppField>
      <Button type="submit" disabled={add.isPending}>{t("buttons.add")}</Button>
    </form>
  );
}
