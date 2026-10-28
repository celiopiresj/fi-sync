"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useMappingForm } from "../_hooks/use-mapping-form";
import { mappingAccountOptions, mappingCardOptions } from "../_lib/options";
import type { MappingFormProps } from "../_types/types";

export function MappingForm(props: MappingFormProps) {
  const { source, accounts, onCancel } = props;
  const t = useTranslations("scrn-open-finance");
  const { form, pending, error, failed, clear, resetCard } = useMappingForm(props);
  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <div className="flex flex-col gap-1"><h2 className="text-sm font-medium">{t("cards.mapping.title")}</h2><p className="text-sm text-muted-foreground">{t("cards.mapping.description")}</p></div>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void form.handleSubmit(); }}>
          <fieldset disabled={pending} className="flex min-w-0 flex-col gap-4">
          <form.AppField name="accountId" listeners={{ onChange: resetCard }}>{(field) => <field.SelectField label={t("fields.account.label")} placeholder={t("fields.account.placeholder")} options={mappingAccountOptions(source, accounts)} />}</form.AppField>
          {source.type === "CREDIT" && <form.Subscribe selector={(state) => state.values.accountId}>{(accountId) => (
            <form.AppField name="cardId">{(field) => <field.SelectField label={t("fields.card.label")} placeholder={t("fields.card.placeholder")} options={mappingCardOptions(accountId, accounts)} />}</form.AppField>
          )}</form.Subscribe>}
          <form.AppField name="fromDate">{(field) => <field.DateField label={t("fields.from.label")} />}</form.AppField>
          {(error || failed) && <p role="alert" className="text-sm text-negative">{error ?? t("errors.provider.description")}</p>}
          <p className="text-sm text-muted-foreground">{t("cards.mapping.editing")}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="submit" disabled={pending || source.currency !== "BRL"}>{t("buttons.saveMapping")}</Button>
            {onCancel && <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>{t("cards.mapping.cancel")}</Button>}
            {source.accountId && !source.hasImports && <Button type="button" variant="ghost" disabled={pending} onClick={() => void clear()}>{t("cards.mapping.clear")}</Button>}
          </div>
          </fieldset>
        </form>
    </div>
  );
}
