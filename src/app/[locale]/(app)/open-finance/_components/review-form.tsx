"use client";

import { useTranslations, useFormatter } from "next-intl";
import { useZodForm } from "@/lib/form/use-zod-form";
import { Button } from "@/components/ui/button";
import { useOpenFinanceMutations } from "../_hooks/use-open-finance";
import { processSchema, reviewDefaults } from "../_schema/schema";
import type { ReviewFormProps } from "../_types/types";

export function ReviewForm(props: ReviewFormProps) {
  const { row, review, onClose } = props;
  const t = useTranslations("scrn-open-finance");
  const formatter = useFormatter();
  const { process } = useOpenFinanceMutations();
  const form = useZodForm(processSchema, { defaultValues: reviewDefaults(props), onSubmit: async ({ value }) => {
    const result = await process.mutateAsync(value);
    if (!result.error) onClose();
  } });
  return (
    <form className="flex flex-col gap-4 px-6 pb-6" onSubmit={(event) => { event.preventDefault(); void form.handleSubmit(); }}>
      <div className="flex flex-col gap-1 rounded-lg bg-muted p-4">
        <span className="font-medium wrap-break-word">{review.description}</span>
        <span>{formatter.number(Number(review.amount), { style: "currency", currency: "BRL" })}</span>
        <span>{row.date}</span>
      </div>
      {review.pending && <p className="text-sm text-warning">{t("errors.pending.description")}</p>}
      {review.payment && <p className="text-sm text-warning">{t("errors.payment.description")}</p>}
      {review.credit && <>
        <form.AppField name="closingDate">{(field) => <field.DateField label={t("fields.closingDate.label")} />}</form.AppField>
        <form.AppField name="dueDate">{(field) => <field.DateField label={t("fields.dueDate.label")} />}</form.AppField>
      </>}
      {review.matches.length > 0 && <>
        <p className="text-sm text-warning">{t("errors.duplicate.description")}</p>
        <form.AppField name="existingTransactionId">{(field) => <field.SelectField label={t("fields.existing.label")} placeholder={t("fields.existing.placeholder")} options={review.matches.map((match) => ({ value: match.id, label: match.description }))} />}</form.AppField>
        <Button type="submit" variant="outline" disabled={process.isPending} onClick={() => form.setFieldValue("mode", "match")}>{t("buttons.match")}</Button>
      </>}
      <Button type="submit" disabled={process.isPending || review.pending || review.payment || review.matches.length > 0} onClick={() => form.setFieldValue("mode", "create")}>{t("buttons.import")}</Button>
      <Button type="submit" variant="outline" disabled={process.isPending} onClick={() => form.setFieldValue("mode", "ignore")}>{t("buttons.ignore")}</Button>
      <Button type="button" variant="ghost" disabled={process.isPending} onClick={onClose}>{t("buttons.close")}</Button>
    </form>
  );
}
