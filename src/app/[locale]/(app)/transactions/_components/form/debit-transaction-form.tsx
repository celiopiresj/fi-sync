"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useStore } from "@tanstack/react-form";
import { toast } from "sonner";
import { useZodForm } from "@/lib/form/use-zod-form";
import { FormError } from "@/components/form/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ItemGroup } from "@/components/ui/item";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PlusIcon, SpinnerIcon, TrashIcon } from "@phosphor-icons/react";
import { CreatePersonInline } from "./create-person-inline";
import {
  debitTransactionSchema,
  refineDebitTransaction,
  transactionTypeValues,
  transactionFormStatusValues,
  paymentMethodFormValues,
  recurrenceFrequencyValues,
  emptyDebitTransactionFormValues,
  type DebitTransactionFormValues,
} from "../../_schema/schema";
import {
  evaluateExpression,
  isCompoundExpression,
} from "@/lib/math/safe-expression";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import { todayCalendarDate } from "@/lib/date";
import { formatPersonName } from "@/lib/format-person-name";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
  TransactionRow,
} from "../../_types/types";

// Split amounts are tracked in integer cents so the "primary absorbs
// the remainder" math, and the pristine-vs-hand-edited comparison in
// handleAddSecondaryPerson below, never drift from floating-point
// rounding — only converted back to a plain 2-decimal string (the
// format every amount field already stores) at the edges.
function toCents(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

function parseAmountLoose(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

// pt-BR uses a comma for the decimal separator — `decimalString` (see
// _schema/schema.ts) already normalizes comma-or-period *input* back to
// a period before parsing, but this is the other direction (a number
// this file computed, going back into a text field the user sees), so
// it has to swap the separator itself or every derived amount (the
// primary's auto-derived share, a redistributed secondary) would render
// "30.00" instead of "30,00" — the locale bug called out in the drawer
// spec's transversal corrections.
function centsToAmountString(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function toFormValues(
  row: TransactionRow | null,
  defaultPersonId: string | null,
): DebitTransactionFormValues {
  // Computed fresh per call (not baked into the static
  // emptyDebitTransactionFormValues) so a form left open across midnight
  // still gets the day it was actually opened on, not a stale cached one.
  if (!row) {
    return {
      ...emptyDebitTransactionFormValues,
      date: todayCalendarDate(),
      personId: defaultPersonId ?? "",
    };
  }

  return {
    accountId: row.accountId,
    categoryId: row.categoryId ?? "",
    description: row.description,
    type: row.amount < 0 ? "expense" : "income",
    amount: Math.abs(row.amount).toString(),
    date: new Date(row.date).toISOString().slice(0, 10),
    status: row.status,
    paymentMethod: row.paymentMethod ?? "",
    recurrence: "none",
    recurrenceCount: "1",
    // The Pessoa field binds to this, not splits[0] — see the
    // personId/splits comments on debitTransactionSchema in
    // _schema/schema.ts.
    personId: row.splits[0]?.personId ?? "",
    // More than one split is what "genuinely divided between people"
    // looks like — reopen it with "Dividir com outras pessoas" already
    // on (see the `isDividing` initial state below) and every split
    // preserved. Zero or one split is the common "not divided" case:
    // `personId` above already carries it, so `splits` stays empty.
    splits:
      row.splits.length > 1
        ? row.splits.map((split) => ({
            personId: split.personId,
            amount: Math.abs(split.amount).toString(),
          }))
        : [],
  };
}

type DebitTransactionFormProps = {
  // Whether this submits to updateDebitTransaction (edit) or
  // createDebitTransaction (create/duplicate) — independent of
  // `initialValues`, since duplicate prefills from a row but still
  // creates a new one.
  isEditing: boolean;
  initialValues: TransactionRow | null;
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  defaultPersonId: string | null;
  onSubmit: (values: DebitTransactionFormValues) => Promise<{ error: string | null }>;
  onSuccess: () => void;
};

export function DebitTransactionForm({
  isEditing,
  initialValues,
  accounts,
  categories,
  people,
  defaultPersonId,
  onSubmit,
  onSuccess,
}: DebitTransactionFormProps) {
  const t = useTranslations("scrn-transactions");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("common.validation");
  const format = useFormatter();
  const [serverError, setServerError] = useState<string | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // Plain `autoFocus` on the input races Radix Sheet's own focus-trap
  // effect (SheetContent, a shared primitive — see the same note on
  // DatePickerRowField's Calendar in picker-row-field.tsx), so focus the
  // amount field explicitly after mount instead. Runs once per open
  // since DebitTransactionSheet remounts this component (key={prefill?.id
  // ?? "create"}) every time the drawer opens.
  useEffect(() => {
    amountInputRef.current?.focus();
  }, []);
  // Which button was clicked — read inside the shared onSubmit handler
  // below to decide whether to close the sheet (the normal "Criar"/
  // "Salvar" button) or reset for another entry ("Salvar e criar
  // outro"). Both are type="submit" on the same <form>, so this is
  // simpler than wiring two separate submit paths through TanStack Form.
  // State, not a ref: the per-button spinner below (isSubmitting &&
  // submitAction === ...) needs to read this during render, which a ref
  // can't do safely.
  const [submitAction, setSubmitAction] = useState<"default" | "createAndNew">(
    "default",
  );

  const [isDividing, setIsDividing] = useState(
    () => (initialValues?.splits.length ?? 0) > 1,
  );

  const schema = useMemo(
    () =>
      debitTransactionSchema.superRefine((value, ctx) =>
        refineDebitTransaction(value, ctx, {
          messages: {
            paymentMethodRequired: tValidation("required"),
            splitsMismatch: t("splits.mismatch"),
          },
        }),
      ),
    [t, tValidation],
  );

  const form = useZodForm(schema, {
    defaultValues: toFormValues(initialValues, defaultPersonId),
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const result = await onSubmit(value);
        if (result?.error) {
          setServerError(result.error);
          return;
        }
        if (submitAction === "createAndNew") {
          toast.success(t("toast.created"));
          form.setFieldValue("description", "");
          form.setFieldValue("amount", "");
          form.setFieldValue("splits", []);
          setIsDividing(false);
          descriptionInputRef.current?.focus();
        } else {
          onSuccess();
        }
      } catch (err) {
        if (isNextRedirectError(err)) throw err;
        setServerError(tCommon("errorGeneric"));
      }
    },
  });

  const accountId = useStore(form.store, (state) => state.values.accountId);
  const personId = useStore(form.store, (state) => state.values.personId);
  const splits = useStore(form.store, (state) => state.values.splits);
  const amount = useStore(form.store, (state) => state.values.amount);
  const description = useStore(form.store, (state) => state.values.description);
  const date = useStore(form.store, (state) => state.values.date);
  const paymentMethod = useStore(form.store, (state) => state.values.paymentMethod);
  const type = useStore(form.store, (state) => state.values.type);
  const categoryId = useStore(form.store, (state) => state.values.categoryId);
  const recurrence = useStore(form.store, (state) => state.values.recurrence);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const isTouched = useStore(form.store, (state) => state.isTouched);

  const evaluatedAmount = isCompoundExpression(amount)
    ? evaluateExpression(amount)
    : null;
  const rawParsedAmount =
    evaluatedAmount ?? (amount ? Number(amount.replace(",", ".")) : NaN);
  const parsedAmount = Number.isFinite(rawParsedAmount) ? rawParsedAmount : null;

  // --- Person split math -----------------------------------------------
  // splits[0] mirrors the top Pessoa field ("Pagou") — its amount is
  // never typed directly; it's derived as "transaction total minus
  // everyone else" and kept in sync below. splits[1+] ("Deve") are who
  // it's divided with, each with its own editable amount.
  const totalCents = toCents(parsedAmount);
  const secondaries = splits.slice(1);
  const secondaryCentsList = secondaries.map((split) =>
    toCents(parseAmountLoose(split.amount)),
  );
  const secondaryCentsSum = secondaryCentsList.reduce((sum, c) => sum + c, 0);
  const primaryAmountCents = totalCents - secondaryCentsSum;
  const primaryAmountDisplay = centsToAmountString(
    Math.max(primaryAmountCents, 0),
  );
  const isOverAllocated = primaryAmountCents < 0;
  const primaryPerson = people.find((person) => person.id === personId);
  const sign = type === "expense" ? -1 : 1;

  // Only categories matching the transaction's own type make sense to
  // pick from — a "Salário" (income) category on an expense row, or
  // vice-versa, was never a real option, just noise in the list.
  const categoryType = type === "income" ? "INCOME" : "EXPENSE";
  const filteredCategories = categories.filter(
    (category) => category.type === categoryType,
  );

  // Switching the type toggle can leave a selected category that no
  // longer matches — cleared rather than left silently invalid, so the
  // field never submits a category of the wrong type. Skips the very
  // first run (mount/prefill) so opening an existing row whose category
  // predates this filter — nothing stopped that combination before —
  // doesn't silently blank a category the user never touched.
  const isFirstCategoryTypeRender = useRef(true);
  useEffect(() => {
    if (isFirstCategoryTypeRender.current) {
      isFirstCategoryTypeRender.current = false;
      return;
    }
    if (categoryId && !filteredCategories.some((c) => c.id === categoryId)) {
      form.setFieldValue("categoryId", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryType]);

  // Turning "Dividir com outras pessoas" on/off is what actually gates
  // whether `splits` is populated at all — off means the top Pessoa
  // field alone carries the attribution (see the personId/splits
  // comments in _schema/schema.ts), so switching off always clears it,
  // and switching on seeds a single Pagou entry (mirroring `personId`)
  // if it isn't already there (e.g. reopening an already-divided row).
  useEffect(() => {
    if (isDividing) {
      if (splits.length === 0) {
        form.setFieldValue("splits", [
          { personId, amount: centsToAmountString(totalCents) },
        ]);
      }
    } else if (splits.length > 0) {
      form.setFieldValue("splits", []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDividing]);

  // The Pagou row is always whoever the top Pessoa field currently says
  // — not independently chosen — so splits[0].personId has to track it
  // live while dividing is active.
  useEffect(() => {
    if (!isDividing) return;
    if (splits[0]?.personId !== personId) {
      form.setFieldValue("splits[0].personId", personId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, isDividing]);

  // Keep splits[0].amount mirroring the derived value above — it's the
  // only source of truth for the primary's amount and it's what
  // actually gets submitted, so this uses the raw (possibly negative)
  // value rather than the floored display version, so an over-allocated
  // split still fails the normal positive-amount validation on submit.
  useEffect(() => {
    if (!isDividing) return;
    const next = centsToAmountString(primaryAmountCents);
    if (splits[0]?.amount !== next) {
      form.setFieldValue("splits[0].amount", next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryAmountCents, isDividing]);

  // Changing the transaction's total amount always redistributes every
  // secondary evenly across the new total, regardless of whether their
  // amounts had been hand-edited (product decision — simpler than also
  // tracking pristine state across a total change). Skipped on the very
  // first render so opening the edit sheet for a transaction that
  // already has a custom split doesn't immediately overwrite it.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (splits.length <= 1) return;
    const peopleCount = splits.length;
    const share = Math.floor(totalCents / peopleCount);
    const shareStr = centsToAmountString(share);
    for (let i = 1; i < splits.length; i++) {
      form.setFieldValue(`splits[${i}].amount`, shareStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCents]);

  // With exactly one secondary the split is unambiguous, so this one
  // gets a hard real-time clamp — it can never take the primary below
  // R$0,01. With 2+ secondaries this becomes a live warning instead
  // (isOverAllocated below), since hard-clamping one of several moving
  // fields against each other gets confusing.
  useEffect(() => {
    if (secondaries.length !== 1) return;
    const maxCents = Math.max(totalCents - 1, 0);
    if (secondaryCentsList[0] > maxCents) {
      const clamped = centsToAmountString(maxCents);
      if (splits[1]?.amount !== clamped) {
        form.setFieldValue("splits[1].amount", clamped);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCents, secondaryCentsList[0], secondaries.length]);

  // Adds a new secondary (splits[1+]) entry. If the current secondaries
  // are still exactly what the even-split formula would generate for
  // today's headcount (nobody's hand-edited an amount, or they typed
  // their way back to the same numbers), redistributes everyone —
  // primary included, via the derived amount above — evenly across the
  // new headcount, truncated to cents with the primary absorbing the
  // remainder. Otherwise the new person just comes in at zero, leaving
  // everyone else exactly where the user left them.
  function handleAddSecondaryPerson(newPersonId = "") {
    const peopleCountBefore = splits.length;
    const shareBefore =
      peopleCountBefore > 0 ? Math.floor(totalCents / peopleCountBefore) : 0;
    const isPristine = secondaryCentsList.every((cents) => cents === shareBefore);

    if (isPristine) {
      const peopleCountAfter = peopleCountBefore + 1;
      const shareAfter = Math.floor(totalCents / peopleCountAfter);
      const shareAfterStr = centsToAmountString(shareAfter);
      for (let i = 1; i < splits.length; i++) {
        form.setFieldValue(`splits[${i}].amount`, shareAfterStr);
      }
      form.pushFieldValue("splits", { personId: newPersonId, amount: shareAfterStr });
    } else {
      form.pushFieldValue("splits", { personId: newPersonId, amount: "0,00" });
    }
  }

  // Named in the same priority order fields appear in the form, so the
  // caption always points at whichever one the user would hit first —
  // a lighter-weight stand-in for mapping every Zod issue to a label
  // (see the footer's "missing field" caption below).
  const missingFieldLabel = !accountId
    ? t("fields.account.label")
    : !description
      ? t("fields.description.label")
      : !amount
        ? t("fields.amount.label")
        : !date
          ? t("fields.date.label")
          : !paymentMethod
            ? t("fields.paymentMethod.label")
            : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <form.AppField name="type">
        {(field) => (
          <field.ToggleGroupField
            label={t("fields.type.label")}
            options={transactionTypeValues.map((value) => ({
              value,
              label: t(`fields.type.${value}`),
            }))}
          />
        )}
      </form.AppField>

      <form.AppField name="amount">
        {(field) => (
          <field.AmountField
            ref={amountInputRef}
            label={t("fields.amount.label")}
            placeholder={t("fields.amount.placeholder")}
            allowExpression
            size="lg"
            footer={
              evaluatedAmount !== null ? (
                <p className="text-xs text-muted-foreground">
                  {t("fields.amount.calculated", {
                    value: format.number(evaluatedAmount, {
                      style: "currency",
                      currency: "BRL",
                    }),
                  })}
                </p>
              ) : undefined
            }
          />
        )}
      </form.AppField>

      <form.AppField name="description">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={field.name} className="text-sm font-medium">
              {t("fields.description.label")}
            </label>
            <Input
              ref={descriptionInputRef}
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder={t("fields.description.placeholder")}
            />
            {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {field.state.meta.errors.join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </form.AppField>

      {/* ItemGroup defaults to `gap-4` between children (a comfortable
          list of cards) — overridden to `gap-0` here since these picker
          rows are meant to read as one dense, bordered group with just a
          divider between rows, not spaced-out cards. */}
      <ItemGroup className="gap-0 divide-y rounded-md border border-border">
        <form.AppField name="date">
          {(field) => (
            <field.DatePickerRowField
              label={t("fields.date.label")}
              placeholder={t("fields.choosePlaceholder")}
              formatDisplay={(value) =>
                format.dateTime(value, { dateStyle: "long" })
              }
            />
          )}
        </form.AppField>

        <form.AppField name="accountId">
          {(field) => (
            <field.PickerRowField
              label={t("fields.account.label")}
              placeholder={t("fields.choosePlaceholder")}
              options={accounts.map((account) => ({
                value: account.id,
                label: account.name,
              }))}
            />
          )}
        </form.AppField>

        <form.AppField name="categoryId">
          {(field) => (
            <field.PickerRowField
              label={t("fields.category.label")}
              placeholder={t("fields.choosePlaceholder")}
              options={filteredCategories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
          )}
        </form.AppField>

        <form.AppField name="paymentMethod">
          {(field) => (
            <field.PickerRowField
              label={t("fields.paymentMethod.label")}
              placeholder={t("fields.choosePlaceholder")}
              options={paymentMethodFormValues.map((method) => ({
                value: method,
                label: t(`fields.paymentMethod.${method}`),
              }))}
            />
          )}
        </form.AppField>

        {/* Only worth asking "who's this for" once there's more than
            just you — with a single self Person, every transaction is
            implicitly yours (the form's own personId default is already
            the self Person's id, see getTransactionFormOptions), so
            showing a picker with nothing real to pick from would just be
            noise. Reappears the moment a second Person exists. */}
        {people.length > 1 && (
          <form.AppField name="personId">
            {(field) => (
              <field.PickerRowField
                label={t("fields.person.label")}
                placeholder={t("fields.choosePlaceholder")}
                options={people.map((person) => ({
                  value: person.id,
                  label: person.name,
                }))}
                formatDisplay={formatPersonName}
                footer={
                  <div className="flex flex-col gap-1.5 border-t border-border p-1.5 pt-2">
                    <CreatePersonInline
                      label={t("splits.newPerson")}
                      triggerClassName="px-1.5"
                      onCreated={(person) => field.handleChange(person.id)}
                    />
                  </div>
                }
              />
            )}
          </form.AppField>
        )}
      </ItemGroup>

      <Accordion type="single" collapsible>
        <AccordionItem value="more-options" className="border-0">
          <AccordionTrigger className="rounded-md border border-border px-3 py-2.5 text-sm font-medium hover:no-underline">
            {t("moreOptions.title")}
          </AccordionTrigger>
          <AccordionContent className="px-0.5">
            <div className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-4">
                <form.AppField name="recurrence">
                  {(field) => (
                    <field.SelectField
                      label={t("fields.recurrence.label")}
                      placeholder={t("fields.recurrence.label")}
                      options={recurrenceFrequencyValues.map((frequency) => ({
                        value: frequency,
                        label: t(`fields.recurrence.${frequency}`),
                      }))}
                    />
                  )}
                </form.AppField>

                {recurrence !== "none" && (
                  <form.AppField name="recurrenceCount">
                    {(field) => (
                      <field.TextField
                        label={t("fields.recurrence.countLabel")}
                        placeholder={t("fields.recurrence.countPlaceholder")}
                      />
                    )}
                  </form.AppField>
                )}
              </div>

              <form.AppField name="status">
                {(field) => (
                  <field.SelectField
                    label={t("fields.status.label")}
                    placeholder={t("fields.status.label")}
                    options={transactionFormStatusValues.map((status) => ({
                      value: status,
                      label: tCommon(`status.${status.toLowerCase()}`),
                    }))}
                  />
                )}
              </form.AppField>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Splitting inherently needs someone else to split WITH — hidden
          for the same "only you exist" reason the personId field above
          is. */}
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
                {format.number(sign * Number(primaryAmountDisplay.replace(",", ".")), {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </div>

            {isOverAllocated && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {t("splits.exceeds", {
                  value: format.number(
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
                  <form.AppField name={`splits[${index}].personId`}>
                    {(field) => (
                      <field.SelectField
                        label={t("fields.person.label")}
                        placeholder={t("fields.person.placeholder")}
                        options={people.map((person) => ({
                          value: person.id,
                          label: formatPersonName(person.name),
                        }))}
                      />
                    )}
                  </form.AppField>
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
              {people.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleAddSecondaryPerson()}
                  className="flex items-center gap-1.5 text-left text-xs/relaxed text-primary transition-colors hover:underline"
                >
                  <PlusIcon className="size-3.5" />
                  {t("splits.addPerson")}
                </button>
              )}
              <CreatePersonInline
                label={t("splits.newPerson")}
                onCreated={(person) => handleAddSecondaryPerson(person.id)}
              />
            </div>
          </div>
        )}
      </div>
      )}

      <FormError title={t("toast.error")} description={serverError} />

      <div className="flex flex-col gap-2">
        {missingFieldLabel && isTouched ? (
          <p className="text-xs text-muted-foreground">
            {t("footer.missingField", { field: missingFieldLabel })}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            onClick={() => {
              setSubmitAction("default");
            }}
            disabled={isSubmitting}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {/* Only the button that was actually clicked shows the
                spinner — both share the same isSubmitting flag while the
                request is in flight, so submitAction (set at click time)
                is what tells the two apart. */}
            {isSubmitting && submitAction === "default" && (
              <SpinnerIcon className="size-4 animate-spin" />
            )}
            {t(isEditing ? "dialog.edit.confirm" : "dialog.create.confirm")}
          </button>
          {!isEditing && (
            <button
              type="submit"
              onClick={() => {
                setSubmitAction("createAndNew");
              }}
              disabled={isSubmitting}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-primary text-sm font-medium text-primary disabled:opacity-60"
            >
              {isSubmitting && submitAction === "createAndNew" && (
                <SpinnerIcon className="size-4 animate-spin" />
              )}
              {t("footer.saveAndCreateAnother")}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
