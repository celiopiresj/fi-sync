"use client";

import { useTranslations, useFormatter } from "next-intl";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { parseCalendarDate } from "@/lib/date";
import { formatPersonName } from "@/lib/format-person-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemGroup } from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { reviewCategoryOptions } from "../_lib/options";
import { reviewDebitPaymentMethodValues } from "../_schema/schema";
import { useReviewForm } from "../_hooks/use-review-form";
import type { ReviewFormProps } from "../_types/types";

export function ReviewForm(props: ReviewFormProps) {
  const { remaining, onClose } = props;
  const t = useTranslations("scrn-open-finance");
  const tCommon = useTranslations("common");
  const formatter = useFormatter();
  const {
    form,
    type,
    existingId,
    personId,
    people,
    isDividing,
    setIsDividing,
    secondaries,
    primaryPerson,
    primaryAmountDisplay,
    primaryAmountCents,
    isOverAllocated,
    sign,
    missingFieldLabel,
    isTouched,
    isAddingPerson,
    setIsAddingPerson,
    newPersonName,
    setNewPersonName,
    isCreatingPerson,
    handleCreatePerson,
    handleAddSecondaryPerson,
    process,
    decide,
    review,
  } = useReviewForm(props);
  return (
    <div className="flex flex-col gap-4 px-6 pb-6">
      <div className="flex flex-col gap-1 rounded-lg bg-muted p-4 text-sm">
        <span className="text-xs text-muted-foreground">{t("dialog.create.original")}</span>
        <span className="font-medium wrap-break-word">{review.description}</span>
        <span>{formatter.number(Number(review.amount), { style: "currency", currency: "BRL" })}</span>
        <span>{formatter.dateTime(parseCalendarDate(review.date), { dateStyle: "short" })}</span>
        {review.installmentNumber && review.installmentCount && (
          <span className="text-xs text-muted-foreground">
            {t("dialog.create.installment", { number: review.installmentNumber, total: review.installmentCount })}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {review.cardName
          ? t("dialog.create.destinationCard", { account: review.destination, card: review.cardName })
          : t("dialog.create.destination", { account: review.destination })}
      </p>
      {review.pending && <p className="text-sm text-warning">{t("errors.pending.description")}</p>}
      {review.payment && <p className="text-sm text-warning">{t("errors.payment.description")}</p>}
      <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void form.handleSubmit(); }}>
        <fieldset disabled={process.isPending} className="flex min-w-0 flex-col gap-4">
          <form.AppField name="type">{(field) => <field.ToggleGroupField label={t("fields.type.label")} options={[
            { value: "expense", label: t("fields.type.expense") },
            { value: "income", label: t(review.credit ? "fields.type.creditIncome" : "fields.type.income") },
          ]} />}</form.AppField>
          <form.AppField name="amount">{(field) => <field.AmountField label={t("fields.amount.label")} placeholder={t("fields.amount.placeholder")} allowExpression size="lg" />}</form.AppField>
          <form.AppField name="description">{(field) => <field.TextField label={t("fields.description.label")} />}</form.AppField>
          <form.AppField name="date">{(field) => <field.DateField label={t("fields.date.label")} />}</form.AppField>
          <ItemGroup className="gap-0 divide-y rounded-md border border-border">
            <form.AppField name="categoryId">{(field) => <field.PickerRowField label={t("fields.category.label")} placeholder={t("fields.category.placeholder")} options={reviewCategoryOptions(review.categories, type)} disabled={process.isPending} />}</form.AppField>
            {!review.credit && (
              <form.AppField name="paymentMethod">{(field) => <field.PickerRowField label={t("fields.paymentMethod.label")} placeholder={t("fields.paymentMethod.placeholder")} options={reviewDebitPaymentMethodValues.map((method) => ({
                value: method,
                label: t(`fields.paymentMethod.${method}`),
              }))} disabled={process.isPending} />}</form.AppField>
            )}
            <form.AppField name="personId">{(field) => <field.PickerRowField label={t("fields.person.label")} placeholder={t("fields.person.placeholder")} options={people.map((person) => ({
              value: person.id,
              label: person.name,
            }))} formatDisplay={formatPersonName} disabled={process.isPending} />}</form.AppField>
          </ItemGroup>
          {!isAddingPerson ? (
            <button
              type="button"
              onClick={() => setIsAddingPerson(true)}
              className="flex w-fit items-center gap-1.5 text-left text-xs/relaxed text-primary transition-colors hover:underline"
            >
              <PlusIcon className="size-3.5" />
              {t("splits.newPerson")}
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-md border border-border p-2">
              <Input
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreatePerson();
                  }
                }}
                placeholder={t("splits.newPersonPlaceholder")}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  disabled={isCreatingPerson || !newPersonName.trim()}
                  onClick={() => void handleCreatePerson()}
                >
                  {tCommon("buttons.save")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingPerson(false);
                    setNewPersonName("");
                  }}
                >
                  {tCommon("buttons.cancel")}
                </Button>
              </div>
            </div>
          )}
          {people.length > 1 && (
            <div className="flex flex-col gap-3 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t("splits.toggleLabel")}</p>
                  {!personId && (
                    <p className="text-xs text-muted-foreground">
                      {t("splits.needsPersonFirst")}
                    </p>
                  )}
                </div>
                <Switch
                  checked={isDividing}
                  onCheckedChange={setIsDividing}
                  disabled={!personId}
                />
              </div>
              {isDividing && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 p-2">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">
                        {t("splits.payerLabel")}
                      </span>
                      <span className="text-sm font-medium">
                        {primaryPerson ? formatPersonName(primaryPerson.name) : "—"}
                      </span>
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {formatter.number(sign * Number(primaryAmountDisplay.replace(",", ".")), {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                  {isOverAllocated && (
                    <p className="text-xs text-negative">
                      {t("splits.exceeds", {
                        value: formatter.number(
                          Math.abs(primaryAmountCents) / 100,
                          { style: "currency", currency: "BRL" },
                        ),
                      })}
                    </p>
                  )}
                  {secondaries.map((_, i) => {
                    const index = i + 1;
                    return (
                      <div
                        key={index}
                        className="flex flex-col gap-2 rounded-md border border-border/60 p-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {t("splits.owesLabel")}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => form.removeFieldValue("splits", index)}
                          >
                            <TrashIcon />
                            <span className="sr-only">{t("splits.remove")}</span>
                          </Button>
                        </div>
                        <ItemGroup className="gap-0 divide-y rounded-md border border-border">
                          <form.AppField name={`splits[${index}].personId`}>
                            {(field) => (
                              <field.PickerRowField
                                label={t("fields.person.label")}
                                placeholder={t("fields.person.placeholder")}
                                options={people.map((person) => ({
                                  value: person.id,
                                  label: person.name,
                                }))}
                                formatDisplay={formatPersonName}
                                disabled={process.isPending}
                              />
                            )}
                          </form.AppField>
                        </ItemGroup>
                        <form.AppField name={`splits[${index}].amount`}>
                          {(field) => (
                            <field.AmountField
                              label={t("fields.amount.label")}
                              placeholder={t("fields.amount.placeholder")}
                            />
                          )}
                        </form.AppField>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
                    <button
                      type="button"
                      onClick={() => handleAddSecondaryPerson()}
                      className="flex items-center gap-1.5 text-left text-xs/relaxed text-primary transition-colors hover:underline"
                    >
                      <PlusIcon className="size-3.5" />
                      {t("splits.addPerson")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {review.credit && (
            <ItemGroup className="gap-0 divide-y rounded-md border border-border">
              <form.AppField name="closingDate">{(field) => <field.DatePickerRowField label={t("fields.closingDate.label")} placeholder={t("fields.closingDate.label")} formatDisplay={(value) => formatter.dateTime(value, { dateStyle: "long" })} disabled={process.isPending} />}</form.AppField>
              <form.AppField name="dueDate">{(field) => <field.DatePickerRowField label={t("fields.dueDate.label")} placeholder={t("fields.dueDate.label")} formatDisplay={(value) => formatter.dateTime(value, { dateStyle: "long" })} disabled={process.isPending} />}</form.AppField>
            </ItemGroup>
          )}
          {missingFieldLabel && isTouched ? (
            <p className="text-xs text-muted-foreground">
              {t("footer.missingField", { field: missingFieldLabel })}
            </p>
          ) : null}
          <Button type="submit" disabled={process.isPending || review.pending || review.payment || review.matches.length > 0}>{remaining > 1 ? t("buttons.saveNext") : t("buttons.import")}</Button>
        </fieldset>
      </form>
      {review.matches.length > 0 && <div className="flex flex-col gap-3">
        <p className="text-sm text-warning">{t("errors.duplicate.description")}</p>
        <ItemGroup className="gap-0 divide-y rounded-md border border-border">
          <form.AppField name="existingTransactionId">{(field) => <field.PickerRowField label={t("fields.existing.label")} placeholder={t("fields.existing.placeholder")} disabled={process.isPending} options={review.matches.map((match) => ({ value: match.id, label: match.description }))} />}</form.AppField>
        </ItemGroup>
        <Button type="button" variant="outline" disabled={process.isPending || !existingId} onClick={() => void decide("match", existingId)}>{t("buttons.match")}</Button>
      </div>}
      {(process.isError || process.data?.error) && <p role="alert" className="text-sm text-negative">{process.data?.error ?? t("errors.provider.description")}</p>}
      <Button type="button" variant="outline" disabled={process.isPending} onClick={() => void decide("ignore")}>{t("buttons.ignore")}</Button>
      <Button type="button" variant="ghost" disabled={process.isPending} onClick={onClose}>{t("buttons.close")}</Button>
    </div>
  );
}
