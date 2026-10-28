"use client";

import { useTranslations } from "next-intl";
import { useZodForm } from "@/lib/form/use-zod-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useOpenFinanceMutations } from "../_hooks/use-open-finance";
import { mappingDefaults, mappingSchema } from "../_schema/schema";
import { mappingAccountOptions, mappingCardOptions } from "../_lib/options";
import type { MappingFormProps } from "../_types/types";

export function MappingForm({ source, accounts }: MappingFormProps) {
  const t = useTranslations("scrn-open-finance");
  const { mapping } = useOpenFinanceMutations();
  const form = useZodForm(mappingSchema, { defaultValues: mappingDefaults(source), onSubmit: async ({ value }) => { await mapping.mutateAsync(value); } });
  return (
    <Card>
      <CardHeader><CardTitle>{source.name}</CardTitle><CardDescription>{t("cards.mapping.description")}</CardDescription></CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void form.handleSubmit(); }}>
          <form.AppField name="accountId">{(field) => <field.SelectField label={t("fields.account.label")} placeholder={t("fields.account.placeholder")} options={mappingAccountOptions(source, accounts)} />}</form.AppField>
          {source.type === "CREDIT" && <form.Subscribe selector={(state) => state.values.accountId}>{(accountId) => (
            <form.AppField name="cardId">{(field) => <field.SelectField label={t("fields.card.label")} placeholder={t("fields.card.placeholder")} options={mappingCardOptions(accountId, accounts)} />}</form.AppField>
          )}</form.Subscribe>}
          <form.AppField name="fromDate">{(field) => <field.DateField label={t("fields.from.label")} />}</form.AppField>
          <Button type="submit" disabled={mapping.isPending || source.currency !== "BRL"}>{t("buttons.saveMapping")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
