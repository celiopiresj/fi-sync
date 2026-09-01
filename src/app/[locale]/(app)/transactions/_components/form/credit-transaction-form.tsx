"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
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
import { PastInstallmentsDialog } from "./past-installments-dialog";
import { EditInstallmentScopeDialog } from "./edit-installment-scope-dialog";
import {
  creditTransactionSchema,
  refineCreditTransaction,
  transactionTypeValues,
  transactionFormStatusValues,
  recurrenceFrequencyValues,
  installmentAmountModeValues,
  emptyCreditTransactionFormValues,
  type CreditTransactionFormValues,
} from "../../_schema/schema";
import {
  previewInvoiceCycle,
  previewCurrentInvoiceCycle,
  previewInstallmentCycles,
} from "../../actions";
import {
  evaluateExpression,
  isCompoundExpression,
} from "@/lib/math/safe-expression";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import { DATE_ONLY_FORMAT_OPTIONS, todayCalendarDate } from "@/lib/date";
import { formatPersonName } from "@/lib/format-person-name";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
  TransactionRow,
} from "../../_types/types";

// Split amounts are tracked in integer cents — same reasoning as
// debit-transaction-form.tsx's own helpers.
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

function toFormValues(
  row: TransactionRow | null,
  defaultPersonId: string | null,
  // Only applied when there's no `row` to prefill from — lets a caller
  // that already knows the context (e.g. invoice-detail-view.tsx, which
  // knows exactly which account/card/cycle it's showing) skip the
  // account/card picker instead of leaving it blank. Ignored while
  // editing/duplicating an existing row.
  defaults?: { accountId?: string; cardId?: string; date?: string },
): CreditTransactionFormValues {
  if (!row) {
    return {
      ...emptyCreditTransactionFormValues,
      date: defaults?.date ?? todayCalendarDate(),
      personId: defaultPersonId ?? "",
      accountId: defaults?.accountId ?? "",
      cardId: defaults?.cardId ?? "",
    };
  }

  return {
    accountId: row.accountId,
    cardId: row.transactionCard?.cardId ?? "",
    categoryId: row.categoryId ?? "",
    description: row.description,
    type: row.amount < 0 ? "expense" : "income",
    amount: Math.abs(row.amount).toString(),
    date: new Date(row.date).toISOString().slice(0, 10),
    status: row.status,
    installments: "1",
    installmentAmountMode: "total",
    recurrence: "none",
    personId: row.splits[0]?.personId ?? "",
    splits:
      row.splits.length > 1
        ? row.splits.map((split) => ({
            personId: split.personId,
            amount: Math.abs(split.amount).toString(),
          }))
        : [],
  };
}

type CreditTransactionFormProps = {
  isEditing: boolean;
  initialValues: TransactionRow | null;
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  defaultPersonId: string | null;
  // See toFormValues' own `defaults` param — only used for a fresh
  // create (isEditing false, initialValues null).
  defaultAccountId?: string;
  defaultCardId?: string;
  defaultDate?: string;
  onSubmit: (
    values: CreditTransactionFormValues,
    options?: {
      skipPastInstallments?: boolean;
      editScope?: "this" | "all" | "future";
    },
  ) => Promise<{ error: string | null }>;
  onSuccess: () => void;
};

export function CreditTransactionForm({
  isEditing,
  initialValues,
  accounts,
  categories,
  people,
  defaultPersonId,
  defaultAccountId,
  defaultCardId,
  defaultDate,
  onSubmit,
  onSuccess,
}: CreditTransactionFormProps) {
  const t = useTranslations("scrn-transactions");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [serverError, setServerError] = useState<string | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountInputRef.current?.focus();
  }, []);
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
      creditTransactionSchema.superRefine((value, ctx) =>
        refineCreditTransaction(value, ctx, {
          splitsMismatch: t("splits.mismatch"),
          recurrenceInstallmentConflict: t("recurrence.conflict"),
        }),
      ),
    [t],
  );

  const [pastInstallmentsValue, setPastInstallmentsValue] =
    useState<CreditTransactionFormValues | null>(null);
  const [pendingEditScopeValue, setPendingEditScopeValue] =
    useState<CreditTransactionFormValues | null>(null);

  // Editing a row that's already part of an installment group always
  // asks how far the change should reach (EditInstallmentScopeDialog
  // below) — a brand-new à-vista→parcelada conversion (handled by the
  // past-due check above instead) never has this, since installmentGroupId
  // is only set once a purchase is already an installment purchase.
  const isInstallmentGroupEdit = isEditing && Boolean(initialValues?.installmentGroupId);

  async function performSubmit(
    value: CreditTransactionFormValues,
    options?: { skipPastInstallments?: boolean; editScope?: "this" | "all" | "future" },
  ) {
    setServerError(null);
    try {
      const result = await onSubmit(value, options);
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
  }

  const form = useZodForm(schema, {
    defaultValues: toFormValues(initialValues, defaultPersonId, {
      accountId: defaultAccountId,
      cardId: defaultCardId,
      date: defaultDate,
    }),
    onSubmit: async ({ value }) => {
      // Editing an existing à-vista purchase into installments only
      // ever CREATES installments 2..N (installment 1 is this same
      // transaction, already dated whenever it was) — so the past-due
      // check has to look at the first of those NEW installments'
      // cycles, not installment 1's own (firstNewInstallmentCycle below
      // already accounts for that offset).
      const submittedInstallmentCount = Number(value.installments || "1");
      if (
        submittedInstallmentCount > 1 &&
        firstNewInstallmentCycle &&
        new Date(firstNewInstallmentCycle.dueDate) < new Date(todayCalendarDate())
      ) {
        setPastInstallmentsValue(value);
        return;
      }
      if (isInstallmentGroupEdit) {
        setPendingEditScopeValue(value);
        return;
      }
      await performSubmit(value);
    },
  });

  const accountId = useStore(form.store, (state) => state.values.accountId);
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const personId = useStore(form.store, (state) => state.values.personId);
  const splits = useStore(form.store, (state) => state.values.splits);
  const amount = useStore(form.store, (state) => state.values.amount);
  const description = useStore(form.store, (state) => state.values.description);
  const date = useStore(form.store, (state) => state.values.date);
  const cardId = useStore(form.store, (state) => state.values.cardId);
  const type = useStore(form.store, (state) => state.values.type);
  const categoryId = useStore(form.store, (state) => state.values.categoryId);
  const installments = useStore(form.store, (state) => state.values.installments);
  const recurrence = useStore(form.store, (state) => state.values.recurrence);
  const installmentAmountMode = useStore(
    form.store,
    (state) => state.values.installmentAmountMode,
  );
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const isTouched = useStore(form.store, (state) => state.isTouched);

  const evaluatedAmount = isCompoundExpression(amount)
    ? evaluateExpression(amount)
    : null;
  const rawParsedAmount =
    evaluatedAmount ?? (amount ? Number(amount.replace(",", ".")) : NaN);
  const parsedAmount = Number.isFinite(rawParsedAmount) ? rawParsedAmount : null;

  const installmentCount = Number(installments || "1");
  const showRecurrence = installmentCount <= 1;
  const showInstallments = recurrence === "none";

  // --- Person split math (identical to debit-transaction-form.tsx's own) -----
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

  // Whether the pending edit actually changed the amount — decides
  // whether EditInstallmentScopeDialog offers "esta e as próximas"
  // alongside "esta"/"todas" (see the dialog's own isAmountChange doc).
  const isPendingAmountChange =
    pendingEditScopeValue !== null &&
    initialValues !== null &&
    Number(pendingEditScopeValue.amount.replace(",", ".")) !==
      Math.abs(initialValues.amount);

  // Only categories matching the transaction's own type make sense to
  // pick from — same rule debit-transaction-form.tsx's own picker
  // follows. "income" here covers "Estorno" too — same underlying
  // schema value, just relabeled on this form (see the type field's own
  // comment below).
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

  // The account's own primary card (cards[0], "Titular" — see
  // credit-card-form.tsx's own comment on that ordering convention)
  // defaults into cardId as soon as its account is picked, instead of
  // forcing a second manual selection for the common case of a single
  // cardholder. Only kicks in when the current cardId doesn't already
  // belong to the newly selected account (covers both a fresh pick and
  // switching accounts) — an edit's already-correct cardId is left alone.
  useEffect(() => {
    if (!selectedAccount) return;
    if (cardId && selectedAccount.cards.some((card) => card.id === cardId)) return;
    const primaryCard = selectedAccount.cards[0];
    if (primaryCard) {
      form.setFieldValue("cardId", primaryCard.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

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

  const { data: invoicePreview } = useQuery({
    queryKey: ["credit-transaction-invoice-preview", accountId, date],
    queryFn: () => previewInvoiceCycle(accountId, date),
    enabled: Boolean(accountId) && Boolean(date),
  });

  // Feeds the past-due-installments check in useZodForm's onSubmit above
  // (referenced there via closure — declared here, after accountId/date/
  // installmentCount exist, rather than before useZodForm, but that's
  // fine: onSubmit only actually runs on a later submit event, by which
  // point this render has already finished and the query variable below
  // is fully initialized).
  const installmentCyclesQuery = useQuery({
    queryKey: ["credit-transaction-installment-cycles", accountId, date, installmentCount],
    queryFn: () => previewInstallmentCycles(accountId, date, installmentCount),
    enabled: Boolean(accountId) && Boolean(date) && installmentCount > 1,
  });
  // When editing, cycles[0] belongs to installment 1 — this same
  // transaction, already existing regardless of any of this — so only
  // cycles[1..] (the ones a submit would actually CREATE) matter for the
  // past-due check and the "add all vs only upcoming" counts below.
  const newInstallmentCycles = isEditing
    ? installmentCyclesQuery.data?.slice(1)
    : installmentCyclesQuery.data;
  const firstNewInstallmentCycle = newInstallmentCycles?.[0];
  const upcomingInstallmentsCount =
    newInstallmentCycles?.filter(
      (cycle) => new Date(cycle.dueDate) >= new Date(todayCalendarDate()),
    ).length ?? 0;

  // Which of the N installments (1-based) the invoice CURRENTLY open for
  // this account corresponds to — matched by closingDate against
  // installmentCyclesQuery's own cycles (installment 1..N, unaffected by
  // the edit-mode slice above: installmentNumber always starts at 1
  // regardless of create vs. à-vista→parcelada conversion). Purely
  // informational context for a backdated/postdated purchase — "where
  // does 'now' fall in this installment sequence" — so it stays null
  // (nothing rendered) whenever the sequence doesn't reach the current
  // invoice at all (every installment already past, or every one still
  // ahead of it).
  const { data: currentInvoiceCycle } = useQuery({
    queryKey: ["credit-transaction-current-invoice-cycle", accountId],
    queryFn: () => previewCurrentInvoiceCycle(accountId),
    enabled: Boolean(accountId) && installmentCount > 1,
  });
  const currentInstallmentIndex = currentInvoiceCycle
    ? (installmentCyclesQuery.data?.findIndex(
        (cycle) =>
          new Date(cycle.closingDate).getTime() ===
          new Date(currentInvoiceCycle.closingDate).getTime(),
      ) ?? -1)
    : -1;
  const currentInstallmentNumber =
    currentInstallmentIndex >= 0 ? currentInstallmentIndex + 1 : null;

  const missingFieldLabel = !accountId
    ? t("fields.card.label")
    : !description
      ? t("fields.description.label")
      : !amount
        ? t("fields.amount.label")
        : !date
          ? t("fields.date.label")
          : !cardId
            ? t("fields.card.holderLabel")
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
            // "Receita" doesn't read naturally for a credit-card account
            // — nobody deposits a salary onto a card. What actually lands
            // here as `type: "income"` is a refund/reversal of a previous
            // purchase, so the credit form's own toggle labels that value
            // "Estorno" instead while keeping the exact same underlying
            // schema value and sign convention as the debit form.
            options={transactionTypeValues.map((value) => ({
              value,
              label: t(value === "income" ? "fields.type.creditIncome" : `fields.type.${value}`),
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
              placeholder={t("fields.description.placeholderCredit")}
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
              label={t("fields.card.label")}
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

        {/* Only worth asking "who's this for" once there's more than
            just you — see debit-transaction-form.tsx's own comment on
            this same field. */}
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

      {invoicePreview && (
        <p className="text-xs text-muted-foreground">
          {t("fields.invoicePreview.label", {
            closingDate: format.dateTime(
              new Date(invoicePreview.closingDate),
              DATE_ONLY_FORMAT_OPTIONS,
            ),
            dueDate: format.dateTime(
              new Date(invoicePreview.dueDate),
              DATE_ONLY_FORMAT_OPTIONS,
            ),
          })}
          {currentInstallmentNumber && (
            <>
              {" "}
              {t("fields.invoicePreview.currentInstallment", {
                number: currentInstallmentNumber,
                total: installmentCount,
              })}
            </>
          )}
        </p>
      )}

      {selectedAccount && (
        <>
          {/* Only worth asking "which card" once there's more than the
              titular's own — same rule the person picker follows
              elsewhere in this form. The default-cardId effect above
              already keeps the titular selected either way. */}
          {selectedAccount.cards.length > 1 && (
            <form.AppField name="cardId">
              {(field) => (
                <field.SelectField
                  label={t("fields.card.holderLabel")}
                  placeholder={t("fields.card.placeholder")}
                  options={selectedAccount.cards
                    // A disabled card (tasks/013.md) drops out of NEW
                    // selections but stays pickable here if it's already
                    // the one selected.
                    .filter((card) => card.status === "ACTIVE" || card.id === cardId)
                    .map((card) => ({
                      value: card.id,
                      label: card.lastFourDigits
                        ? `${card.name} •••• ${card.lastFourDigits}`
                        : card.name,
                    }))}
                />
              )}
            </form.AppField>
          )}

          {showInstallments && (
            <form.AppField name="installments">
              {(field) => (
                <field.TextField
                  type="number"
                  label={t("fields.installments.label")}
                  placeholder={t("fields.installments.placeholder")}
                />
              )}
            </form.AppField>
          )}

          {showInstallments && installmentCount > 1 && (
            <div className="flex flex-col gap-1.5">
              <form.AppField name="installmentAmountMode">
                {(field) => (
                  <field.ToggleGroupField
                    label={t("fields.installmentAmountMode.label")}
                    options={installmentAmountModeValues.map((mode) => ({
                      value: mode,
                      label: t(`fields.installmentAmountMode.${mode}`),
                    }))}
                  />
                )}
              </form.AppField>
              {installmentAmountMode === "perInstallment" && parsedAmount !== null && (
                <p className="text-xs text-muted-foreground">
                  {t("fields.installmentAmountMode.totalPreview", {
                    value: format.number(parsedAmount * installmentCount, {
                      style: "currency",
                      currency: "BRL",
                    }),
                  })}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <Accordion type="single" collapsible>
        <AccordionItem value="more-options" className="border-0">
          <AccordionTrigger className="rounded-md border border-border px-3 py-2.5 text-sm font-medium hover:no-underline">
            {t("moreOptions.title")}
          </AccordionTrigger>
          <AccordionContent className="px-0.5">
            <div className="flex flex-col gap-4 pt-2">
              {showRecurrence && (
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
              )}

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
            {isSubmitting && submitAction === "default" && (
              <SpinnerIcon className="size-4 animate-spin" />
            )}
            {t(isEditing ? "dialog.editCredit.confirm" : "dialog.createCredit.confirm")}
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

      {pastInstallmentsValue && firstNewInstallmentCycle && (
        <PastInstallmentsDialog
          open
          onOpenChange={(open) => {
            if (!open) setPastInstallmentsValue(null);
          }}
          firstDueDate={new Date(firstNewInstallmentCycle.dueDate)}
          totalInstallments={Number(pastInstallmentsValue.installments || "1")}
          upcomingInstallments={upcomingInstallmentsCount}
          isSubmitting={isSubmitting}
          onAddAll={async () => {
            await performSubmit(pastInstallmentsValue, { skipPastInstallments: false });
            setPastInstallmentsValue(null);
          }}
          onAddUpcoming={async () => {
            await performSubmit(pastInstallmentsValue, { skipPastInstallments: true });
            setPastInstallmentsValue(null);
          }}
        />
      )}

      {pendingEditScopeValue && initialValues && (
        <EditInstallmentScopeDialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingEditScopeValue(null);
          }}
          installmentNumber={initialValues.installmentNumber ?? 1}
          installmentCount={initialValues.installmentCount ?? 1}
          isAmountChange={isPendingAmountChange}
          isSubmitting={isSubmitting}
          onChooseScope={async (scope) => {
            await performSubmit(pendingEditScopeValue, { editScope: scope });
            setPendingEditScopeValue(null);
          }}
        />
      )}
    </form>
  );
}
