"use client";

import { AmountInput } from "@/components/form/amount-field";
import { FormError } from "@/components/form/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { parseLocalCalendarDate, todayCalendarDate } from "@/lib/date";
import { formatPersonName } from "@/lib/format-person-name";
import {
  evaluateExpression,
  isCompoundExpression,
} from "@/lib/math/safe-expression";
import {
  PencilSimpleIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  emptyBatchRow,
  paymentMethodFormValues,
  transactionTypeValues,
  type BatchRowFormValues,
} from "../../_schema/schema";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
} from "../../_types/types";
import { ChipSelect, DateChipSelect } from "./chip-select";
import { CreatePersonInline } from "./create-person-inline";

// A fresh row defaulting to today and to `defaultPersonId` — same
// reasoning as the single-transaction form's toFormValues — computed
// per call, not baked into the static emptyBatchRow, so a table left
// open across midnight still starts new rows on the day they're
// actually added.
function makeEmptyRow(defaultPersonId: string | null): BatchRowFormValues {
  return {
    ...emptyBatchRow,
    date: todayCalendarDate(),
    personId: defaultPersonId ?? "",
  };
}

// Resolves the draft's typed amount (comma/period decimals, or an
// expression like "120+35" — same convention as the single-transaction
// form's amount field) to a plain positive number, or null if it isn't
// one yet. Queue items store the *resolved* value (see handleAddOrSave
// below), not the raw typed string — a queued row is a fixed snapshot,
// not something that re-evaluates later.
function resolveAmount(raw: string): number | null {
  const evaluated = isCompoundExpression(raw) ? evaluateExpression(raw) : null;
  const parsed = evaluated ?? (raw ? Number(raw.replace(",", ".")) : NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Split amounts are tracked in integer cents — same reasoning (and same
// helpers, duplicated per this route's own self-containment convention)
// as debit-transaction-form.tsx's own "Dividir com outras pessoas" math.
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

type BatchTransactionTableProps = {
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  defaultPersonId: string | null;
  onSubmit: (
    rows: BatchRowFormValues[],
  ) => Promise<{ error: string | null; rowIndex: number | null }>;
  onSuccess: (count: number) => void;
};

export function BatchTransactionTable({
  accounts,
  categories,
  people,
  defaultPersonId,
  onSubmit,
  onSuccess,
}: BatchTransactionTableProps) {
  const t = useTranslations("scrn-transactions");
  const format = useFormatter();

  // Batch entry is debit-only — a credit-card account needs the
  // single-transaction form so the invoice/installment logic in
  // `createTransaction` actually runs (see actions.ts,
  // `resolveInvoiceForDate`). Leaving cards out of this list is what
  // keeps that constraint honest instead of silently creating a
  // transaction with no invoice link. Investment/pocket accounts are
  // excluded too — aporte/resgate against them only ever goes through
  // the dedicated Investments screen now (investments/actions.ts's own
  // createInvestmentMovement posts both transfer legs), never here.
  const debitAccounts = accounts.filter(
    (account) =>
      account.type === "CHECKING" ||
      account.type === "SAVINGS" ||
      account.type === "CASH",
  );

  const [draft, setDraft] = useState<BatchRowFormValues>(() =>
    makeEmptyRow(defaultPersonId),
  );
  const [draftError, setDraftError] = useState<string | null>(null);
  // Index into `queue` while editing an existing item (pencil icon) —
  // null means the draft form is building a brand-new entry.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [queue, setQueue] = useState<BatchRowFormValues[]>([]);
  // Splitting a specific amount with specific people doesn't carry over
  // to the next queued row the way account/category/person do — starts
  // false for every new entry (handleAddOrSave/handleCancelEdit reset it),
  // re-derived from the row's own splits when editing one back in
  // (handleEdit).
  const [isDividing, setIsDividing] = useState(false);

  const [serverError, setServerError] = useState<string | null>(null);
  const [errorRowIndex, setErrorRowIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only categories matching the draft row's own type — same rule the
  // single-transaction forms' pickers follow.
  const categoryType = draft.type === "income" ? "INCOME" : "EXPENSE";
  const filteredCategories = categories.filter(
    (category) => category.type === categoryType,
  );

  function patchDraft(patch: Partial<BatchRowFormValues>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      // The category picker is scoped to the row's own type (see
      // filteredCategories below) — switching type drops a categoryId
      // that no longer matches, same "dependent field reset" the credit
      // batch table already does for cardId when accountId changes.
      if (patch.type !== undefined && patch.type !== current.type) {
        const nextCategoryType = patch.type === "income" ? "INCOME" : "EXPENSE";
        const category = categories.find((c) => c.id === current.categoryId);
        if (category && category.type !== nextCategoryType) next.categoryId = "";
      }
      return next;
    });
  }

  // --- Person split math (identical to debit-transaction-form.tsx's own,
  // adapted from TanStack Form field ops to plain draft/setDraft state) --
  const splits = draft.splits;
  const secondaries = splits.slice(1);
  const totalCents = toCents(resolveAmount(draft.amount));
  const secondaryCentsList = secondaries.map((split) =>
    toCents(parseAmountLoose(split.amount)),
  );
  const secondaryCentsSum = secondaryCentsList.reduce((sum, c) => sum + c, 0);
  const primaryAmountCents = totalCents - secondaryCentsSum;
  const primaryAmountDisplay = centsToAmountString(
    Math.max(primaryAmountCents, 0),
  );
  const isOverAllocated = primaryAmountCents < 0;
  const primaryPerson = people.find((person) => person.id === draft.personId);
  const sign = draft.type === "expense" ? -1 : 1;

  useEffect(() => {
    if (isDividing) {
      if (splits.length === 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        patchDraft({
          splits: [
            { personId: draft.personId, amount: centsToAmountString(totalCents) },
          ],
        });
      }
    } else if (splits.length > 0) {
      patchDraft({ splits: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDividing]);

  useEffect(() => {
    if (!isDividing) return;
    if (splits[0]?.personId !== draft.personId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      patchDraft({
        splits: splits.map((s, i) =>
          i === 0 ? { ...s, personId: draft.personId } : s,
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.personId, isDividing]);

  useEffect(() => {
    if (!isDividing) return;
    const next = centsToAmountString(primaryAmountCents);
    if (splits[0]?.amount !== next) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      patchDraft({
        splits: splits.map((s, i) => (i === 0 ? { ...s, amount: next } : s)),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryAmountCents, isDividing]);

  const isFirstTotalRender = useRef(true);
  useEffect(() => {
    if (isFirstTotalRender.current) {
      isFirstTotalRender.current = false;
      return;
    }
    if (splits.length <= 1) return;
    const peopleCount = splits.length;
    const share = Math.floor(totalCents / peopleCount);
    const shareStr = centsToAmountString(share);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    patchDraft({
      splits: splits.map((s, i) => (i === 0 ? s : { ...s, amount: shareStr })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCents]);

  useEffect(() => {
    if (secondaries.length !== 1) return;
    const maxCents = Math.max(totalCents - 1, 0);
    if (secondaryCentsList[0] > maxCents) {
      const clamped = centsToAmountString(maxCents);
      if (splits[1]?.amount !== clamped) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        patchDraft({
          splits: splits.map((s, i) => (i === 1 ? { ...s, amount: clamped } : s)),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCents, secondaryCentsList[0], secondaries.length]);

  // Same "redistribute if pristine, else come in at zero" rule as
  // debit-transaction-form.tsx's own handleAddSecondaryPerson.
  function handleAddSecondaryPerson(newPersonId = "") {
    const peopleCountBefore = splits.length;
    const shareBefore =
      peopleCountBefore > 0 ? Math.floor(totalCents / peopleCountBefore) : 0;
    const isPristine = secondaryCentsList.every((cents) => cents === shareBefore);

    if (isPristine) {
      const peopleCountAfter = peopleCountBefore + 1;
      const shareAfter = Math.floor(totalCents / peopleCountAfter);
      const shareAfterStr = centsToAmountString(shareAfter);
      const redistributed = splits.map((s, i) =>
        i === 0 ? s : { ...s, amount: shareAfterStr },
      );
      patchDraft({
        splits: [...redistributed, { personId: newPersonId, amount: shareAfterStr }],
      });
    } else {
      patchDraft({ splits: [...splits, { personId: newPersonId, amount: "0,00" }] });
    }
  }

  function handleRemoveSecondary(index: number) {
    patchDraft({ splits: splits.filter((_, i) => i !== index) });
  }

  function handleAddOrSave() {
    const resolved = resolveAmount(draft.amount);
    const missingLabel = !draft.description.trim()
      ? t("fields.description.label")
      : resolved === null
        ? t("fields.amount.label")
        : !draft.date
          ? t("fields.date.label")
          : !draft.accountId
            ? t("fields.account.label")
            : !draft.paymentMethod
              ? t("fields.paymentMethod.label")
              : !draft.personId
                ? t("fields.person.label")
                : null;

    if (missingLabel || resolved === null) {
      // `missingLabel` is only ever null here if `resolved` is what
      // failed (see the ternary above — the two can't both be "the
      // passing case" and still land in this branch), but TypeScript
      // can't follow that correlation through an `||`, hence the
      // fallback — never actually reached at runtime.
      setDraftError(t("batch.missingField", { field: missingLabel ?? "" }));
      return;
    }

    if (isDividing) {
      const splitsTotal = draft.splits.reduce(
        (sum, split) => sum + (parseAmountLoose(split.amount) ?? 0),
        0,
      );
      if (Math.abs(splitsTotal - resolved) > 0.01) {
        setDraftError(t("splits.mismatch"));
        return;
      }
    }
    setDraftError(null);

    // The queue stores a resolved, fixed snapshot — editing the draft's
    // chips afterward (building the next entry) never reaches back into
    // an already-queued item.
    const snapshot: BatchRowFormValues = {
      ...draft,
      amount: resolved.toFixed(2).replace(".", ","),
    };

    if (editingIndex !== null) {
      setQueue((current) =>
        current.map((row, i) => (i === editingIndex ? snapshot : row)),
      );
      setEditingIndex(null);
    } else {
      setQueue((current) => [...current, snapshot]);
    }

    // Chips "remember" their last value for the next entry — only
    // description/amount reset, matching the spec's replacement for the
    // old "mesma conta/tipo/pessoa para todas" global toggles. Splits
    // don't carry over (see isDividing's own comment above) — always back
    // to "not divided" for whatever gets added/built next.
    setDraft({ ...snapshot, description: "", amount: "", splits: [] });
    setIsDividing(false);
  }

  function handleEdit(index: number) {
    setDraft(queue[index]);
    setEditingIndex(index);
    setDraftError(null);
    setIsDividing(queue[index].splits.length > 0);
    // Loading a row's own amount into the draft changes totalCents, which
    // would otherwise trip the "redistribute secondaries" effect right as
    // this row's already-custom split loads in — unlike the single-
    // transaction form (a fresh component instance per edit, so its own
    // isFirstRender ref only ever needs to guard one mount), this table
    // stays mounted across edits of many different rows, so the guard has
    // to be re-armed on every entry into edit mode, not just once ever.
    isFirstTotalRender.current = true;
  }

  function handleCancelEdit() {
    setEditingIndex(null);
    setIsDividing(false);
    setDraft((current) => ({ ...current, description: "", amount: "", splits: [] }));
    setDraftError(null);
  }

  function handleDelete(index: number) {
    setQueue((current) => current.filter((_, i) => i !== index));
    if (editingIndex === index) handleCancelEdit();
  }

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const row of queue) {
      const value = Number(row.amount.replace(",", ".")) || 0;
      if (row.type === "income") income += value;
      else expense += value;
    }
    return {
      income,
      expense,
      net: income - expense,
      hasIncome: queue.some((row) => row.type === "income"),
      hasExpense: queue.some((row) => row.type === "expense"),
    };
  }, [queue]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (queue.length === 0) return;
    setServerError(null);
    setErrorRowIndex(null);
    setIsSubmitting(true);
    try {
      const result = await onSubmit(queue);
      if (result.error) {
        setServerError(result.error);
        setErrorRowIndex(result.rowIndex);
      } else {
        onSuccess(queue.length);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function subtitleFor(row: BatchRowFormValues): string {
    // Every field checked here is already required before a row can
    // join the queue (see handleAddOrSave's missingLabel check) — the
    // `undefined` cases below are just type-level defensiveness against
    // `parseLocalCalendarDate`'s general signature, not expected at
    // runtime for a queued row.
    const parsedDate = parseLocalCalendarDate(row.date);
    const parts = [
      parsedDate ? format.dateTime(parsedDate, { dateStyle: "short" }) : null,
      debitAccounts.find((a) => a.id === row.accountId)?.name,
      categories.find((c) => c.id === row.categoryId)?.name,
      row.paymentMethod ? t(`fields.paymentMethod.${row.paymentMethod}`) : null,
      (() => {
        const person = people.find((p) => p.id === row.personId);
        return person ? formatPersonName(person.name) : null;
      })(),
      row.splits.length > 1
        ? t("table.splitPill", { count: row.splits.length })
        : null,
    ];
    return parts.filter(Boolean).join(" · ");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{t("batch.title")}</p>
        <p className="text-xs text-muted-foreground">
          {t("batch.description")}
        </p>
      </div>

        <div className="flex flex-col gap-3 rounded-lg border border-primary/40 p-3">
          {editingIndex !== null && (
            <p className="text-xs font-medium text-primary">
              {t("batch.editingRow")}
            </p>
          )}

          <ToggleGroup
            type="single"
            variant="tabs"
            value={draft.type}
            onValueChange={(value) => {
              if (value)
                patchDraft({ type: value as BatchRowFormValues["type"] });
            }}
            className="w-full">
            {transactionTypeValues.map((type) => (
              <ToggleGroupItem key={type} value={type} className="flex-1">
                {t(`fields.type.${type}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="flex gap-2">
            <Input
              className="flex-1"
              value={draft.description}
              onChange={(e) => patchDraft({ description: e.target.value })}
              placeholder={t("fields.description.placeholder")}
            />
            <AmountInput
              className="w-28"
              value={draft.amount}
              onChange={(value) => patchDraft({ amount: value })}
              placeholder={t("fields.amount.placeholder")}
              allowExpression
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <DateChipSelect
              label={t("batch.columns.date")}
              value={draft.date}
              onChange={(value) => patchDraft({ date: value })}
              sheetTitle={t("batch.columns.date")}
            />
            <ChipSelect
              label={t("batch.columns.account")}
              value={draft.accountId}
              onChange={(value) => patchDraft({ accountId: value })}
              options={debitAccounts.map((account) => ({
                value: account.id,
                label: account.name,
              }))}
              sheetTitle={t("batch.columns.account")}
            />
            <ChipSelect
              label={t("batch.columns.paymentMethod")}
              value={draft.paymentMethod}
              onChange={(value) => patchDraft({ paymentMethod: value })}
              options={paymentMethodFormValues.map((method) => ({
                value: method,
                label: t(`fields.paymentMethod.${method}`),
              }))}
              sheetTitle={t("batch.columns.paymentMethod")}
            />
            <ChipSelect
              label={t("batch.columns.category")}
              value={draft.categoryId}
              onChange={(value) => patchDraft({ categoryId: value })}
              options={filteredCategories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
              sheetTitle={t("batch.columns.category")}
            />
            {/* Only worth asking "who's this for" once there's more
                than just you — see debit-transaction-form.tsx's own
                comment on the same field. */}
            {people.length > 1 && (
              <ChipSelect
                label={t("batch.columns.person")}
                value={draft.personId}
                onChange={(value) => patchDraft({ personId: value })}
                options={people.map((person) => ({
                  value: person.id,
                  label: person.name,
                }))}
                formatDisplay={formatPersonName}
                sheetTitle={t("batch.columns.person")}
                footer={
                  <div className="border-t border-border p-1.5 pt-2">
                    <CreatePersonInline
                      label={t("splits.newPerson")}
                      triggerClassName="px-1.5"
                      onCreated={(person) => patchDraft({ personId: person.id })}
                    />
                  </div>
                }
              />
            )}
          </div>

          {/* Compact counterpart of debit-transaction-form.tsx's own
              "Dividir com outras pessoas" card — same toggle/payer/owes
              shape, sized down (ChipSelect + a narrow AmountInput per row
              instead of full SelectField/AmountField blocks) to fit this
              already-dense draft card. Same "only worth it with someone
              else to split with" gating as the Pessoa chip above. */}
          {people.length > 1 && (
            <div className="flex flex-col gap-2 rounded-md border border-border/60 p-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium">{t("splits.toggleLabel")}</p>
                  {!draft.personId && (
                    <p className="text-[11px] text-muted-foreground">
                      {t("splits.needsPersonFirst")}
                    </p>
                  )}
                </div>
                <Switch
                  checked={isDividing}
                  onCheckedChange={setIsDividing}
                  disabled={!draft.personId}
                />
              </div>

              {isDividing && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 p-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-muted-foreground">
                        {t("splits.payerLabel")}
                      </span>
                      <span className="text-xs font-medium">
                        {primaryPerson ? formatPersonName(primaryPerson.name) : "—"}
                      </span>
                    </div>
                    <span className="text-xs font-medium tabular-nums">
                      {format.number(
                        sign * Number(primaryAmountDisplay.replace(",", ".")),
                        { style: "currency", currency: "BRL" },
                      )}
                    </span>
                  </div>

                  {isOverAllocated && (
                    <p className="text-[11px] text-red-600 dark:text-red-400">
                      {t("splits.exceeds", {
                        value: format.number(Math.abs(primaryAmountCents) / 100, {
                          style: "currency",
                          currency: "BRL",
                        }),
                      })}
                    </p>
                  )}

                  {secondaries.map((split, i) => {
                    const index = i + 1;
                    return (
                      <div key={index} className="flex items-center gap-1.5">
                        <ChipSelect
                          label={t("fields.person.label")}
                          value={split.personId}
                          onChange={(value) =>
                            patchDraft({
                              splits: splits.map((s, si) =>
                                si === index ? { ...s, personId: value } : s,
                              ),
                            })
                          }
                          options={people.map((person) => ({
                            value: person.id,
                            label: person.name,
                          }))}
                          formatDisplay={formatPersonName}
                          sheetTitle={t("fields.person.label")}
                        />
                        <AmountInput
                          className="w-24"
                          value={split.amount}
                          onChange={(value) =>
                            patchDraft({
                              splits: splits.map((s, si) =>
                                si === index ? { ...s, amount: value } : s,
                              ),
                            })
                          }
                          placeholder={t("fields.amount.placeholder")}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveSecondary(index)}
                        >
                          <TrashIcon />
                          <span className="sr-only">{t("splits.remove")}</span>
                        </Button>
                      </div>
                    );
                  })}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
                    <button
                      type="button"
                      onClick={() => handleAddSecondaryPerson()}
                      className="flex items-center gap-1.5 text-left text-[11px] text-primary transition-colors hover:underline"
                    >
                      <PlusIcon className="size-3.5" />
                      {t("splits.addPerson")}
                    </button>
                    <CreatePersonInline
                      label={t("splits.newPerson")}
                      triggerClassName="px-1.5"
                      onCreated={(person) => handleAddSecondaryPerson(person.id)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {draftError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {draftError}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="button" onClick={handleAddOrSave} className="flex-1">
              {editingIndex !== null ? t("batch.saveChange") : t("batch.add")}
            </Button>
            {editingIndex !== null && (
              <Button type="button" variant="ghost" onClick={handleCancelEdit}>
                {t("batch.cancelEdit")}
              </Button>
            )}
          </div>
        </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {t("batch.queueTitle", { count: queue.length })}
        </p>

        {queue.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            {t("batch.empty")}
          </p>
        ) : (
          <div className="flex flex-col divide-y rounded-md border border-border">
            {queue.map((row, index) => {
              const sign = row.type === "expense" ? -1 : 1;
              return (
                <div
                  key={index}
                  className={`flex items-center justify-between gap-2 p-2.5 ${
                    editingIndex === index
                      ? "bg-muted"
                      : errorRowIndex === index
                        ? "bg-destructive/5"
                        : ""
                  }`}>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {row.description}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {subtitleFor(row)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-sm font-medium tabular-nums">
                      {format.number(
                        sign * Number(row.amount.replace(",", ".")),
                        {
                          style: "currency",
                          currency: "BRL",
                        },
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleEdit(index)}>
                      <PencilSimpleIcon />
                      <span className="sr-only">{t("batch.editRow")}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(index)}>
                      <TrashIcon />
                      <span className="sr-only">{t("batch.removeRow")}</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FormError title={t("toast.error")} description={serverError} />

      {queue.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-border p-3">
          {totals.hasIncome && totals.hasExpense ? (
            <>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("batch.totalIncome")}</span>
                <span className="tabular-nums text-positive">
                  {format.number(totals.income, {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("batch.totalExpense")}</span>
                <span className="tabular-nums text-negative">
                  {format.number(-totals.expense, {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm font-medium">
                <span>{t("batch.netTotal")}</span>
                <span className="tabular-nums">
                  {format.number(totals.net, {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-sm font-medium">
              <span>{t("batch.total")}</span>
              <span className="tabular-nums">
                {format.number(
                  totals.hasIncome ? totals.income : -totals.expense,
                  {
                    style: "currency",
                    currency: "BRL",
                  },
                )}
              </span>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || queue.length === 0}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60">
        {isSubmitting && <SpinnerIcon className="size-4 animate-spin" />}
        {t("batch.submit")}
      </button>
    </form>
  );
}
