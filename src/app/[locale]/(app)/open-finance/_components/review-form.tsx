"use client";

import { useTranslations, useFormatter } from "next-intl";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { parseCalendarDate } from "@/lib/date";
import { formatPersonName } from "@/lib/format-person-name";
import { AmountInput } from "@/components/form/amount-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemGroup } from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { reviewCategoryOptions } from "../_lib/options";
import { reviewDebitPaymentMethodValues } from "../_schema/schema";
import { useReviewForm } from "../_hooks/use-review-form";
import { PickerRow } from "./picker-row";
import type { ReviewFormProps } from "../_types/types";

export function ReviewForm(props: ReviewFormProps) {
  const { remaining, onClose } = props;
  const t = useTranslations("scrn-open-finance");
  const tCommon = useTranslations("common");
  const formatter = useFormatter();
  const {
    draft,
    fieldErrors,
    people,
    isDividing,
    toggleDividing,
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
    updateField,
    updateType,
    updateAmount,
    updateSecondaryPerson,
    updateSecondaryAmount,
    removeSecondaryPerson,
    submit,
    process,
    decide,
    review,
  } = useReviewForm(props);

  return (
    <div className="flex flex-col gap-4 px-6 pb-6">
      <div className="flex flex-col gap-1 rounded-lg bg-muted p-4 text-sm">
        <span className="text-xs text-muted-foreground">
          {t("dialog.create.original")}
        </span>
        <span className="font-medium wrap-break-word">{review.description}</span>
        <span>
          {formatter.number(Number(review.amount), {
            style: "currency",
            currency: "BRL",
          })}
        </span>
        <span>
          {formatter.dateTime(parseCalendarDate(review.date), {
            dateStyle: "short",
          })}
        </span>
        {review.installmentNumber && review.installmentCount && (
          <span className="text-xs text-muted-foreground">
            {t("dialog.create.installment", {
              number: review.installmentNumber,
              total: review.installmentCount,
            })}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {review.cardName
          ? t("dialog.create.destinationCard", {
              account: review.destination,
              card: review.cardName,
            })
          : t("dialog.create.destination", { account: review.destination })}
      </p>
      {review.pending && (
        <p className="text-sm text-warning">{t("errors.pending.description")}</p>
      )}
      {review.payment && (
        <p className="text-sm text-warning">{t("errors.payment.description")}</p>
      )}
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset
          disabled={process.isPending}
          className="flex min-w-0 flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("fields.type.label")}</span>
            <ToggleGroup
              type="single"
              variant="tabs"
              value={draft.type}
              onValueChange={(value) => {
                if (value === "expense" || value === "income") {
                  updateType(value);
                }
              }}
              className="w-full"
            >
              <ToggleGroupItem value="expense" className="flex-1">
                {t("fields.type.expense")}
              </ToggleGroupItem>
              <ToggleGroupItem value="income" className="flex-1">
                {t(
                  review.credit
                    ? "fields.type.creditIncome"
                    : "fields.type.income",
                )}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex flex-col gap-1 rounded-lg bg-surface-1 px-4 py-3">
            <label
              htmlFor="review-amount"
              className="text-xs text-muted-foreground"
            >
              {t("fields.amount.label")}
            </label>
            <AmountInput
              id="review-amount"
              name="amount"
              value={draft.amount}
              onChange={updateAmount}
              placeholder={t("fields.amount.placeholder")}
              isInvalid={Boolean(fieldErrors.amount)}
              allowExpression
              size="lg"
            />
            {fieldErrors.amount ? (
              <p className="text-xs text-negative">{fieldErrors.amount}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="review-description" className="text-sm font-medium">
              {t("fields.description.label")}
            </label>
            <Input
              id="review-description"
              name="description"
              value={draft.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
            {fieldErrors.description ? (
              <p className="text-xs text-negative">{fieldErrors.description}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="review-date" className="text-sm font-medium">
              {t("fields.date.label")}
            </label>
            <Input
              id="review-date"
              name="date"
              type="date"
              value={draft.date}
              onChange={(e) => updateField("date", e.target.value)}
            />
            {fieldErrors.date ? (
              <p className="text-xs text-negative">{fieldErrors.date}</p>
            ) : null}
          </div>

          <ItemGroup className="gap-0 divide-y rounded-md border border-border">
            <PickerRow
              label={t("fields.category.label")}
              placeholder={t("fields.category.placeholder")}
              value={draft.categoryId}
              onChange={(value) => updateField("categoryId", value)}
              options={reviewCategoryOptions(review.categories, draft.type)}
              disabled={process.isPending}
              error={fieldErrors.categoryId}
            />
            {!review.credit && (
              <PickerRow
                label={t("fields.paymentMethod.label")}
                placeholder={t("fields.paymentMethod.placeholder")}
                value={draft.paymentMethod}
                onChange={(value) =>
                  updateField(
                    "paymentMethod",
                    value as typeof draft.paymentMethod,
                  )
                }
                options={reviewDebitPaymentMethodValues.map((method) => ({
                  value: method,
                  label: t(`fields.paymentMethod.${method}`),
                }))}
                disabled={process.isPending}
                error={fieldErrors.paymentMethod}
              />
            )}
            <PickerRow
              label={t("fields.person.label")}
              placeholder={t("fields.person.placeholder")}
              value={draft.personId}
              onChange={(value) => updateField("personId", value)}
              options={people.map((person) => ({
                value: person.id,
                label: person.name,
              }))}
              formatDisplay={formatPersonName}
              disabled={process.isPending}
              error={fieldErrors.personId}
            />
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
                  onClick={() => void handleCreatePerson()}
                  disabled={isCreatingPerson || !newPersonName.trim()}
                >
                  {t("splits.newPersonConfirm")}
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

          <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            <label className="flex cursor-pointer items-center justify-between gap-2 text-xs/relaxed">
              <span>{t("splits.toggleLabel")}</span>
              <Switch checked={isDividing} onCheckedChange={toggleDividing} />
            </label>

            {isDividing && (
              <div className="flex flex-col gap-3 border-t border-border pt-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {t("splits.primaryLabel")}
                  </span>
                  <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs/relaxed">
                    <span>
                      {primaryPerson
                        ? formatPersonName(primaryPerson.name)
                        : "—"}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatter.number((primaryAmountCents / 100) * sign, {
                        style: "currency",
                        currency: "BRL",
                      })}
                      {" ("}
                      R$ {primaryAmountDisplay}
                      {")"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {t("splits.secondaryLabel")}
                  </span>
                  {secondaries.map((secondary, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-2 rounded-md border border-border p-2"
                    >
                      <ItemGroup className="gap-0 rounded-md border border-border">
                        <PickerRow
                          label={t("splits.personLabel")}
                          placeholder={t("splits.personPlaceholder")}
                          value={secondary.personId}
                          onChange={(value) =>
                            updateSecondaryPerson(index, value)
                          }
                          options={people
                            .filter((person) => person.id !== draft.personId)
                            .map((person) => ({
                              value: person.id,
                              label: person.name,
                            }))}
                          formatDisplay={formatPersonName}
                        />
                      </ItemGroup>
                      <div className="flex items-end gap-2">
                        <div className="flex flex-1 flex-col gap-1.5">
                          <label className="text-sm font-medium">
                            {t("splits.amountLabel")}
                          </label>
                          <AmountInput
                            value={secondary.amount}
                            onChange={(value) =>
                              updateSecondaryAmount(index, value)
                            }
                            placeholder={t("fields.amount.placeholder")}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("splits.removePerson")}
                          onClick={() => removeSecondaryPerson(index)}
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {isOverAllocated && (
                    <p className="text-xs text-negative">
                      {t("splits.mismatch")}
                    </p>
                  )}
                  {fieldErrors.splits && !isOverAllocated && (
                    <p className="text-xs text-negative">
                      {fieldErrors.splits}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddSecondaryPerson()}
                    >
                      <PlusIcon />
                      {t("splits.addPerson")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {review.credit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="review-closing-date"
                  className="text-sm font-medium"
                >
                  {t("fields.closingDate.label")}
                </label>
                <Input
                  id="review-closing-date"
                  name="closingDate"
                  type="date"
                  value={draft.closingDate}
                  onChange={(e) => updateField("closingDate", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="review-due-date" className="text-sm font-medium">
                  {t("fields.dueDate.label")}
                </label>
                <Input
                  id="review-due-date"
                  name="dueDate"
                  type="date"
                  value={draft.dueDate}
                  onChange={(e) => updateField("dueDate", e.target.value)}
                />
              </div>
            </div>
          )}

          {missingFieldLabel && isTouched && (
            <p className="text-center text-xs text-muted-foreground">
              {t("validation.missingField", { field: missingFieldLabel })}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="submit"
              disabled={
                process.isPending ||
                review.pending ||
                review.payment ||
                review.matches.length > 0
              }
            >
              {t(remaining > 1 ? "buttons.saveNext" : "buttons.create")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={process.isPending}
              onClick={() => void decide("ignore")}
            >
              {t("buttons.ignore")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={process.isPending}
              onClick={onClose}
            >
              {t("buttons.close")}
            </Button>
          </div>
        </fieldset>
      </form>
      {review.matches.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-warning">
            {t("errors.duplicate.description")}
          </p>
          <ItemGroup className="gap-0 divide-y rounded-md border border-border">
            <PickerRow
              label={t("fields.existing.label")}
              placeholder={t("fields.existing.placeholder")}
              value={draft.existingTransactionId}
              onChange={(value) => updateField("existingTransactionId", value)}
              disabled={process.isPending}
              options={review.matches.map((match) => ({
                value: match.id,
                label: match.description,
              }))}
            />
          </ItemGroup>
          <Button
            type="button"
            variant="outline"
            disabled={process.isPending || !draft.existingTransactionId}
            onClick={() => void decide("match", draft.existingTransactionId)}
          >
            {t("buttons.match")}
          </Button>
        </div>
      )}
      {(process.isError || process.data?.error) && (
        <p role="alert" className="text-sm text-negative">
          {process.data?.error ?? t("errors.provider.description")}
        </p>
      )}
    </div>
  );
}
