"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useStore } from "@tanstack/react-form";
import { useZodForm } from "@/lib/form/use-zod-form";
import { FormError } from "@/components/form/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ItemGroup } from "@/components/ui/item";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { CreatePersonInline } from "./create-person-inline";
import {
  debitRecurrenceContentSchema,
  debitRecurrenceCreateSchema,
  refineDebitRecurrence,
  recurrenceFrequencyValues,
  recurrenceTypeValues,
  paymentMethodFormValues,
  emptyDebitRecurrenceCreateValues,
  type DebitRecurrenceContentFormValues,
  type DebitRecurrenceCreateFormValues,
} from "../../_schema/schema";
import {
  evaluateExpression,
  isCompoundExpression,
} from "@/lib/math/safe-expression";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import { todayCalendarDate, dateOnlyKey } from "@/lib/date";
import { formatPersonName } from "@/lib/format-person-name";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
  RecurrenceRow,
} from "../../_types/types";

// Split amounts are tracked in integer cents so the "primary absorbs the
// remainder" math, and the pristine-vs-hand-edited comparison in
// handleAddSecondaryPerson below, never drift from floating-point
// rounding — only converted back to a plain 2-decimal string at the
// edges. Identical to (and duplicated from, per this screen's own
// _schema/_lib/actions-per-route convention) transaction-form.tsx's own
// helpers of the same name.
function toCents(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

function parseAmountLoose(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function centsToAmountString(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

// Non-ACTIVE accounts (tasks/007: archived accounts disappear from
// pickers) are excluded, mirroring BatchTransactionTable's own account
// picker. Editing keeps the row's current account selectable even if
// it's since been archived, same as the transaction form's own
// selectableAccounts.
function selectableAccounts(
  accounts: AccountOption[],
  currentAccountId: string | undefined,
): AccountOption[] {
  return accounts.filter(
    (account) => account.status === "ACTIVE" || account.id === currentAccountId,
  );
}

// The type/amount/description/account/category/paymentMethod/person+
// splits/endDate fields below are deliberately DUPLICATED between
// DebitRecurrenceCreateForm and DebitRecurrenceEditForm rather than
// factored into a shared subcomponent — same call as
// debit-transaction-form.tsx, which stays one self-contained component
// rather than splitting its fields out. The two forms validate against
// different schemas (debitRecurrenceCreateSchema extends
// debitRecurrenceContentSchema with the schedule fields), and threading
// one TanStack Form instance through a shared component's props means
// either fighting its generics across two different TFormData shapes or
// falling back to `any`. Duplicating the fields here is the smaller cost.

type DebitRecurrenceCreateFormProps = {
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  defaultPersonId: string | null;
  defaultAccountId: string | null;
  onSubmit: (
    values: DebitRecurrenceCreateFormValues,
  ) => Promise<{ error: string | null }>;
  onSuccess: () => void;
};

export function DebitRecurrenceCreateForm({
  accounts,
  categories,
  people,
  defaultPersonId,
  defaultAccountId,
  onSubmit,
  onSuccess,
}: DebitRecurrenceCreateFormProps) {
  const t = useTranslations("scrn-recurrences");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("common.validation");
  const format = useFormatter();
  const [serverError, setServerError] = useState<string | null>(null);
  // Indefinite by default (no end date) — the common case (rent,
  // subscriptions) has no known stop date, and tasks/012's own framing
  // ("posso definir uma data pra parar ou não") leads with the option to
  // not set one at all.
  const [hasEndDate, setHasEndDate] = useState(false);
  const [isDividing, setIsDividing] = useState(false);

  const schema = useMemo(
    () =>
      debitRecurrenceCreateSchema.superRefine((value, ctx) =>
        refineDebitRecurrence(value, ctx, {
          paymentMethodRequired: tValidation("required"),
          splitsMismatch: t("splits.mismatch"),
        }),
      ),
    [t, tValidation],
  );

  const form = useZodForm(schema, {
    defaultValues: {
      ...emptyDebitRecurrenceCreateValues,
      startDate: todayCalendarDate(),
      personId: defaultPersonId ?? "",
      accountId: defaultAccountId ?? "",
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const result = await onSubmit(value);
        if (result?.error) {
          setServerError(result.error);
          return;
        }
        onSuccess();
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
  const type = useStore(form.store, (state) => state.values.type);
  const categoryId = useStore(form.store, (state) => state.values.categoryId);

  const evaluatedAmount = isCompoundExpression(amount)
    ? evaluateExpression(amount)
    : null;
  const rawParsedAmount =
    evaluatedAmount ?? (amount ? Number(amount.replace(",", ".")) : NaN);
  const parsedAmount = Number.isFinite(rawParsedAmount) ? rawParsedAmount : null;

  // --- Person split math -------------------------------------------
  // splits[0] mirrors the top Pessoa field ("Pagou") — its amount is
  // never typed directly; it's derived as "total minus everyone else"
  // and kept in sync below. splits[1+] ("Deve") are who it's divided
  // with, each with its own editable amount. Identical logic to
  // transaction-form.tsx's own split-math block.
  const totalCents = toCents(parsedAmount);
  const secondaries = splits.slice(1);
  const secondaryCentsList = secondaries.map((split) =>
    toCents(parseAmountLoose(split.amount)),
  );
  const secondaryCentsSum = secondaryCentsList.reduce((sum, c) => sum + c, 0);
  const primaryAmountCents = totalCents - secondaryCentsSum;
  const primaryAmountDisplay = centsToAmountString(Math.max(primaryAmountCents, 0));
  const isOverAllocated = primaryAmountCents < 0;
  const primaryPerson = people.find((person) => person.id === personId);
  const sign = type === "expense" ? -1 : 1;

  // Only categories matching the recurrence's own type make sense to
  // pick from — same rule the transaction forms' pickers follow.
  const categoryType = type === "income" ? "INCOME" : "EXPENSE";
  const filteredCategories = categories.filter(
    (category) => category.type === categoryType,
  );

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

  useEffect(() => {
    if (!isDividing) return;
    if (splits[0]?.personId !== personId) {
      form.setFieldValue("splits[0].personId", personId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, isDividing]);

  useEffect(() => {
    if (!isDividing) return;
    const next = centsToAmountString(primaryAmountCents);
    if (splits[0]?.amount !== next) {
      form.setFieldValue("splits[0].amount", next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryAmountCents, isDividing]);

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
            options={recurrenceTypeValues.map((value) => ({
              value,
              label: t(`fields.type.${value}`),
            }))}
          />
        )}
      </form.AppField>

      <form.AppField name="amount">
        {(field) => (
          <field.AmountField
            label={t("fields.amount.label")}
            placeholder={t("fields.amount.placeholder")}
            allowExpression
            size="lg"
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

      <ItemGroup className="gap-0 divide-y rounded-md border border-border">
        <form.AppField name="accountId">
          {(field) => (
            <field.PickerRowField
              label={t("fields.account.label")}
              placeholder={t("fields.choosePlaceholder")}
              options={selectableAccounts(accounts, accountId).map((account) => ({
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
      </ItemGroup>

      <ItemGroup className="gap-0 divide-y rounded-md border border-border">
        <form.AppField name="startDate">
          {(field) => (
            <field.DatePickerRowField
              label={t("fields.startDate.label")}
              placeholder={t("fields.choosePlaceholder")}
              // `value` here is a browser-LOCAL Date from
              // parseLocalCalendarDate (see DatePickerRowField's own doc
              // comment in picker-row-field.tsx) — format with
              // next-intl's default (also local) timeZone, same as
              // transaction-form.tsx's own "date" row.
              formatDisplay={(value) =>
                format.dateTime(value, { dateStyle: "long" })
              }
            />
          )}
        </form.AppField>

        <form.AppField name="frequency">
          {(field) => (
            <field.PickerRowField
              label={t("fields.frequency.label")}
              placeholder={t("fields.choosePlaceholder")}
              options={recurrenceFrequencyValues.map((frequency) => ({
                value: frequency,
                label: t(`table.frequency.${frequency}`),
              }))}
            />
          )}
        </form.AppField>
      </ItemGroup>

      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t("fields.endDate.toggleLabel")}</p>
            <p className="text-xs text-muted-foreground">
              {t("fields.endDate.toggleHelp")}
            </p>
          </div>
          <Switch
            checked={hasEndDate}
            onCheckedChange={(checked) => {
              setHasEndDate(checked);
              if (!checked) form.setFieldValue("endDate", "");
            }}
          />
        </div>
        {hasEndDate && (
          <form.AppField name="endDate">
            {(field) => (
              <field.DatePickerRowField
                label={t("fields.endDate.label")}
                placeholder={t("fields.choosePlaceholder")}
                formatDisplay={(value) =>
                  format.dateTime(value, { dateStyle: "long" })
                }
              />
            )}
          </form.AppField>
        )}
      </div>

      <ItemGroup className="gap-0 divide-y rounded-md border border-border">
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
                {format.number(
                  sign * Number(primaryAmountDisplay.replace(",", ".")),
                  { style: "currency", currency: "BRL" },
                )}
              </span>
            </div>

            {isOverAllocated && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {t("splits.exceeds", {
                  value: format.number(Math.abs(primaryAmountCents) / 100, {
                    style: "currency",
                    currency: "BRL",
                  }),
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

      <form.AppForm>
        <form.SubmitButton label={t("dialog.create.title")} />
      </form.AppForm>
    </form>
  );
}

function toEditFormValues(row: RecurrenceRow): DebitRecurrenceContentFormValues {
  return {
    type: row.amount < 0 ? "expense" : "income",
    amount: Math.abs(row.amount).toString(),
    description: row.description,
    accountId: row.accountId,
    categoryId: row.categoryId ?? "",
    paymentMethod: row.paymentMethod ?? "",
    // The Pessoa field binds to this, not splits[0] — same convention as
    // transactions' own toFormValues.
    personId: row.splits[0]?.personId ?? "",
    splits:
      row.splits.length > 1
        ? row.splits.map((split) => ({
            personId: split.personId,
            amount: Math.abs(split.amount).toString(),
          }))
        : [],
    // `row.endDate` is a value read back from a `@db.Date` column (UTC
    // midnight for that calendar day, not "midnight in some zone") —
    // dateOnlyKey reads its UTC digits directly, which is what correctly
    // round-trips into DatePickerRowField's own browser-LOCAL string
    // convention regardless of which zone the browser is in. Neither
    // APP_TIME_ZONE-pinning (parseCalendarDate) nor a bare
    // `new Date(...)` local read would be safe here — see the file-level
    // comment in @/lib/date.ts.
    endDate: row.endDate ? dateOnlyKey(row.endDate) : "",
    // Same dateOnlyKey round-trip as endDate above — now editable (see
    // debitRecurrenceContentSchema's own startDate doc comment), unlike
    // frequency, which stays a read-only display value below.
    startDate: dateOnlyKey(row.startDate),
  };
}

type DebitRecurrenceEditFormProps = {
  initialValues: RecurrenceRow;
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  onSubmit: (
    values: DebitRecurrenceContentFormValues,
  ) => Promise<{ error: string | null; updatedCount?: number }>;
  onSuccess: (updatedCount: number | undefined) => void;
};

export function DebitRecurrenceEditForm({
  initialValues,
  accounts,
  categories,
  people,
  onSubmit,
  onSuccess,
}: DebitRecurrenceEditFormProps) {
  const t = useTranslations("scrn-recurrences");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("common.validation");
  const format = useFormatter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [hasEndDate, setHasEndDate] = useState(() => Boolean(initialValues.endDate));
  const [isDividing, setIsDividing] = useState(() => initialValues.splits.length > 1);

  const schema = useMemo(
    () =>
      debitRecurrenceContentSchema.superRefine((value, ctx) =>
        refineDebitRecurrence(value, ctx, {
          paymentMethodRequired: tValidation("required"),
          splitsMismatch: t("splits.mismatch"),
        }),
      ),
    [t, tValidation],
  );

  const form = useZodForm(schema, {
    defaultValues: useMemo(() => toEditFormValues(initialValues), [initialValues]),
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const result = await onSubmit(value);
        if (result?.error) {
          setServerError(result.error);
          return;
        }
        onSuccess(result.updatedCount);
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
  const type = useStore(form.store, (state) => state.values.type);
  const categoryId = useStore(form.store, (state) => state.values.categoryId);

  const evaluatedAmount = isCompoundExpression(amount)
    ? evaluateExpression(amount)
    : null;
  const rawParsedAmount =
    evaluatedAmount ?? (amount ? Number(amount.replace(",", ".")) : NaN);
  const parsedAmount = Number.isFinite(rawParsedAmount) ? rawParsedAmount : null;

  const totalCents = toCents(parsedAmount);
  const secondaries = splits.slice(1);
  const secondaryCentsList = secondaries.map((split) =>
    toCents(parseAmountLoose(split.amount)),
  );
  const secondaryCentsSum = secondaryCentsList.reduce((sum, c) => sum + c, 0);
  const primaryAmountCents = totalCents - secondaryCentsSum;
  const primaryAmountDisplay = centsToAmountString(Math.max(primaryAmountCents, 0));
  const isOverAllocated = primaryAmountCents < 0;
  const primaryPerson = people.find((person) => person.id === personId);
  const sign = type === "expense" ? -1 : 1;

  // Only categories matching the recurrence's own type make sense to
  // pick from — same rule the transaction forms' pickers follow.
  const categoryType = type === "income" ? "INCOME" : "EXPENSE";
  const filteredCategories = categories.filter(
    (category) => category.type === categoryType,
  );

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

  useEffect(() => {
    if (!isDividing) return;
    if (splits[0]?.personId !== personId) {
      form.setFieldValue("splits[0].personId", personId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, isDividing]);

  useEffect(() => {
    if (!isDividing) return;
    const next = centsToAmountString(primaryAmountCents);
    if (splits[0]?.amount !== next) {
      form.setFieldValue("splits[0].amount", next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryAmountCents, isDividing]);

  // Skipped on the very first render so opening the edit sheet for a
  // recurrence that already has a custom split doesn't immediately
  // overwrite it — same guard as transaction-form.tsx's own.
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

  const frequencySummary = t("scheduleSummary", {
    frequency: t(`table.frequency.${initialValues.frequency}`).toLowerCase(),
  });

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
            options={recurrenceTypeValues.map((value) => ({
              value,
              label: t(`fields.type.${value}`),
            }))}
          />
        )}
      </form.AppField>

      <form.AppField name="amount">
        {(field) => (
          <field.AmountField
            label={t("fields.amount.label")}
            placeholder={t("fields.amount.placeholder")}
            allowExpression
            size="lg"
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

      <ItemGroup className="gap-0 divide-y rounded-md border border-border">
        <form.AppField name="accountId">
          {(field) => (
            <field.PickerRowField
              label={t("fields.account.label")}
              placeholder={t("fields.choosePlaceholder")}
              options={selectableAccounts(accounts, accountId).map((account) => ({
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
      </ItemGroup>

      {/* Frequency stays read-only — see debitRecurrenceCreateSchema's
          doc comment in _schema/schema.ts. startDate, below, IS editable
          here (unlike frequency): changing it only shifts which day
          future, not-yet-generated occurrences land on — see
          cascadeRecurrenceDateShift in actions.ts. */}
      <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        {frequencySummary}
      </p>

      <ItemGroup className="gap-0 divide-y rounded-md border border-border">
        <form.AppField name="startDate">
          {(field) => (
            <field.DatePickerRowField
              label={t("fields.startDate.label")}
              placeholder={t("fields.choosePlaceholder")}
              formatDisplay={(value) =>
                format.dateTime(value, { dateStyle: "long" })
              }
            />
          )}
        </form.AppField>
      </ItemGroup>
      <p className="text-xs text-muted-foreground">{t("fields.startDate.editHelp")}</p>

      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t("fields.endDate.toggleLabel")}</p>
            <p className="text-xs text-muted-foreground">
              {t("fields.endDate.toggleHelp")}
            </p>
          </div>
          <Switch
            checked={hasEndDate}
            onCheckedChange={(checked) => {
              setHasEndDate(checked);
              if (!checked) form.setFieldValue("endDate", "");
            }}
          />
        </div>
        {hasEndDate && (
          <form.AppField name="endDate">
            {(field) => (
              <field.DatePickerRowField
                label={t("fields.endDate.label")}
                placeholder={t("fields.choosePlaceholder")}
                formatDisplay={(value) =>
                  format.dateTime(value, { dateStyle: "long" })
                }
              />
            )}
          </form.AppField>
        )}
      </div>

      <ItemGroup className="gap-0 divide-y rounded-md border border-border">
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
                {format.number(
                  sign * Number(primaryAmountDisplay.replace(",", ".")),
                  { style: "currency", currency: "BRL" },
                )}
              </span>
            </div>

            {isOverAllocated && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {t("splits.exceeds", {
                  value: format.number(Math.abs(primaryAmountCents) / 100, {
                    style: "currency",
                    currency: "BRL",
                  }),
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

      <form.AppForm>
        <form.SubmitButton label={t("dialog.edit.title")} />
      </form.AppForm>
    </form>
  );
}
