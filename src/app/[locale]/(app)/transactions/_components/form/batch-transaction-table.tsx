"use client";

import { FormError } from "@/components/form/form-error";
import { Button } from "@/components/ui/button";
import { parseLocalCalendarDate, todayCalendarDate } from "@/lib/date";
import { formatPersonName } from "@/lib/format-person-name";
import {
  PencilSimpleIcon,
  SpinnerIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  emptyBatchRow,
  type BatchRowFormValues,
} from "../../_schema/schema";
import { parseAmountLoose, resolveAmount } from "../../_lib/batch-amounts";
import { filterDebitBatchAccounts } from "../../_lib/batch-accounts";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
} from "../../_types/types";
import { BatchRowFields } from "./batch-row-fields";

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

  const debitAccounts = filterDebitBatchAccounts(accounts);

  const [draft, setDraft] = useState<BatchRowFormValues>(() =>
    makeEmptyRow(defaultPersonId),
  );
  const [draftError, setDraftError] = useState<string | null>(null);
  // Index into `queue` while editing an existing item (pencil icon) —
  // null means the draft form is building a brand-new entry.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [queue, setQueue] = useState<BatchRowFormValues[]>([]);
  // Bumped every time the draft becomes "a different row" (added, edited,
  // cancelled). BatchRowFields keys off this so it remounts and re-derives
  // its own divide-with-people toggle from the row it is handed, instead
  // of that state leaking from one entry into the next.
  const [draftKey, setDraftKey] = useState(0);

  const [serverError, setServerError] = useState<string | null>(null);
  const [errorRowIndex, setErrorRowIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function patchDraft(patch: Partial<BatchRowFormValues>) {
    setDraft((current) => ({ ...current, ...patch }));
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
            : !draft.categoryId
              ? t("fields.category.label")
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

    // A row carrying splits is by definition one that was divided — the
    // toggle itself lives inside BatchRowFields now, so the check reads
    // off the row rather than off a separate flag here.
    if (draft.splits.length > 0) {
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
    // don't carry over — always back to "not divided" for whatever gets
    // added/built next.
    setDraft({ ...snapshot, description: "", amount: "", splits: [] });
    setDraftKey((key) => key + 1);
  }

  function handleEdit(index: number) {
    setDraft(queue[index]);
    setEditingIndex(index);
    setDraftError(null);
    setDraftKey((key) => key + 1);
  }

  function handleCancelEdit() {
    setEditingIndex(null);
    setDraft((current) => ({ ...current, description: "", amount: "", splits: [] }));
    setDraftError(null);
    setDraftKey((key) => key + 1);
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

          <BatchRowFields
            key={draftKey}
            value={draft}
            onChange={patchDraft}
            accounts={debitAccounts}
            categories={categories}
            people={people}
          />

          {draftError && (
            <p className="text-xs text-negative">{draftError}</p>
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
