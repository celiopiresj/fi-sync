"use client";

import { useTranslations, useFormatter } from "next-intl";
import { parseCalendarDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { reviewCategoryOptions } from "../_lib/options";
import { useReviewForm } from "../_hooks/use-review-form";
import type { ReviewFormProps } from "../_types/types";

export function ReviewForm(props: ReviewFormProps) {
  const { remaining, onClose } = props;
  const t = useTranslations("scrn-open-finance");
  const formatter = useFormatter();
  const { form, process, decide, resetCategory, review } = useReviewForm(props);
  return (
    <div className="flex flex-col gap-4 px-6 pb-6">
      <div className="flex flex-col gap-1 rounded-lg bg-muted p-4 text-sm">
        <span className="text-xs text-muted-foreground">{t("dialog.create.original")}</span>
        <span className="font-medium wrap-break-word">{review.description}</span>
        <span>{formatter.number(Number(review.amount), { style: "currency", currency: "BRL" })}</span>
        <span>{formatter.dateTime(parseCalendarDate(review.date), { dateStyle: "short" })}</span>
      </div>
      <p className="text-sm text-muted-foreground">{t("dialog.create.destination", { account: review.destination })}</p>
      {review.pending && <p className="text-sm text-warning">{t("errors.pending.description")}</p>}
      {review.payment && <p className="text-sm text-warning">{t("errors.payment.description")}</p>}
      <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void form.handleSubmit(); }}>
        <fieldset disabled={process.isPending} className="flex min-w-0 flex-col gap-4">
          <form.AppField name="description">{(field) => <field.TextField label={t("fields.description.label")} />}</form.AppField>
          <form.AppField name="date">{(field) => <field.DateField label={t("fields.date.label")} />}</form.AppField>
          <form.AppField name="type" listeners={{ onChange: resetCategory }}>{(field) => <field.SelectField label={t("fields.type.label")} placeholder={t("fields.type.placeholder")} options={[
            { value: "expense", label: t("fields.type.expense") }, { value: "income", label: t("fields.type.income") },
          ]} />}</form.AppField>
          <form.AppField name="amount">{(field) => <field.AmountField label={t("fields.amount.label")} placeholder={t("fields.amount.placeholder")} />}</form.AppField>
          <form.Subscribe selector={(state) => state.values.type}>{(type) => <form.AppField name="categoryId">{(field) => <field.SelectField label={t("fields.category.label")} placeholder={t("fields.category.placeholder")} options={reviewCategoryOptions(review.categories, type, t("fields.category.none"))} />}</form.AppField>}</form.Subscribe>
          {review.credit && <>
            <form.AppField name="closingDate">{(field) => <field.DateField label={t("fields.closingDate.label")} />}</form.AppField>
            <form.AppField name="dueDate">{(field) => <field.DateField label={t("fields.dueDate.label")} />}</form.AppField>
          </>}
          <Button type="submit" disabled={process.isPending || review.pending || review.payment || review.matches.length > 0}>{remaining > 1 ? t("buttons.saveNext") : t("buttons.import")}</Button>
        </fieldset>
      </form>
      {review.matches.length > 0 && <div className="flex flex-col gap-3">
        <p className="text-sm text-warning">{t("errors.duplicate.description")}</p>
        <form.AppField name="existingTransactionId">{(field) => <field.SelectField label={t("fields.existing.label")} placeholder={t("fields.existing.placeholder")} disabled={process.isPending} options={review.matches.map((match) => ({ value: match.id, label: match.description }))} />}</form.AppField>
        <form.Subscribe selector={(state) => state.values.existingTransactionId}>{(existingId) => <Button type="button" variant="outline" disabled={process.isPending || !existingId} onClick={() => void decide("match", existingId)}>{t("buttons.match")}</Button>}</form.Subscribe>
      </div>}
      {(process.isError || process.data?.error) && <p role="alert" className="text-sm text-negative">{process.data?.error ?? t("errors.provider.description")}</p>}
      <Button type="button" variant="outline" disabled={process.isPending} onClick={() => void decide("ignore")}>{t("buttons.ignore")}</Button>
      <Button type="button" variant="ghost" disabled={process.isPending} onClick={onClose}>{t("buttons.close")}</Button>
    </div>
  );
}
