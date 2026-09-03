"use client";

import { createElement, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DrawerClose, DrawerTitle } from "@/components/ui/drawer";
import { FormError } from "@/components/form/form-error";
import { cn } from "@/lib/utils";
import { todayCalendarDate } from "@/lib/date";
import { resolveCategoryIcon } from "@/lib/category-icons";
import {
  CheckIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { emptyBatchRow, type BatchRowFormValues } from "../../_schema/schema";
import { parseAmountLoose, resolveAmount } from "../../_lib/batch-amounts";
import { filterDebitBatchAccounts } from "../../_lib/batch-accounts";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
} from "../../_types/types";
import { BatchRowFields } from "./batch-row-fields";
import { ChipSelect, DateChipSelect } from "./chip-select";

type BatchTransactionMobileProps = {
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  defaultPersonId: string | null;
  onSubmit: (
    rows: BatchRowFormValues[],
  ) => Promise<{ error: string | null; rowIndex: number | null }>;
  onSuccess: (count: number) => void;
};

// The FAB's full-screen batch screen. Same rows, same schema and the
// same Server Action as /transactions' BatchTransactionTable — what
// differs is the shape of the interaction, which is why this is its own
// component rather than a responsive variant of that table:
//
//  - account and date are hoisted out of the rows into one "applies to
//    every row" header, since a phone batch is almost always "today, on
//    this account, a handful of things I just bought";
//  - rows are edited in place (tap to expand) instead of through a
//    separate draft card pinned above a queue — there is no room on a
//    phone for both, and the expanded row is the same BatchRowFields the
//    desktop draft card uses, so the fields and the split math stay
//    shared rather than reimplemented.
export function BatchTransactionMobile({
  accounts,
  categories,
  people,
  defaultPersonId,
  onSubmit,
  onSuccess,
}: BatchTransactionMobileProps) {
  const t = useTranslations("scrn-transactions");
  const format = useFormatter();

  const debitAccounts = useMemo(
    () => filterDebitBatchAccounts(accounts),
    [accounts],
  );

  // Applied to every row on submit (see rowsForSubmit) rather than
  // written into each row as it changes — one source of truth, so a row
  // added before the account was picked can't keep a stale one.
  const [accountId, setAccountId] = useState(
    () => debitAccounts[0]?.id ?? "",
  );
  const [date, setDate] = useState(() => todayCalendarDate());

  const [rows, setRows] = useState<BatchRowFormValues[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [errorRowIndex, setErrorRowIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function patchRow(index: number, patch: Partial<BatchRowFormValues>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function handleAddRow() {
    setRows((current) => [
      ...current,
      {
        ...emptyBatchRow,
        date,
        accountId,
        personId: defaultPersonId ?? "",
      },
    ]);
    // The new row opens straight into edit mode — it is empty, so there
    // is nothing to read in its collapsed form anyway.
    setExpandedIndex(rows.length);
  }

  function handleDeleteRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
    setExpandedIndex((current) => {
      if (current === null) return null;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
  }

  // A row can be posted once it carries everything the Server Action
  // requires that isn't supplied by the shared header (account/date).
  // Category is optional here for the same reason it is in the desktop
  // table — `createTransactionsBatch` doesn't require it.
  function isRowReady(row: BatchRowFormValues): boolean {
    if (!row.description.trim()) return false;
    if (resolveAmount(row.amount) === null) return false;
    if (!row.paymentMethod) return false;
    if (!row.personId) return false;
    if (row.splits.length > 0) {
      const resolved = resolveAmount(row.amount) ?? 0;
      const splitsTotal = row.splits.reduce(
        (sum, split) => sum + (parseAmountLoose(split.amount) ?? 0),
        0,
      );
      if (Math.abs(splitsTotal - resolved) > 0.01) return false;
    }
    return true;
  }

  const readyCount = rows.filter(isRowReady).length;
  const allReady = rows.length > 0 && readyCount === rows.length;
  const canSubmit = allReady && Boolean(accountId) && Boolean(date);

  // Signed total of the rows that would actually be posted.
  const total = rows.reduce((sum, row) => {
    if (!isRowReady(row)) return sum;
    const value = resolveAmount(row.amount) ?? 0;
    return sum + (row.type === "expense" ? -value : value);
  }, 0);

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setServerError(null);
    setErrorRowIndex(null);
    setIsSubmitting(true);
    try {
      // The header's account/date are stamped onto every row here — the
      // rows themselves never carry a divergent value.
      const rowsForSubmit = rows.map((row) => ({
        ...row,
        accountId,
        date,
        amount: (resolveAmount(row.amount) ?? 0).toFixed(2).replace(".", ","),
      }));
      const result = await onSubmit(rowsForSubmit);
      if (result.error) {
        setServerError(result.error);
        setErrorRowIndex(result.rowIndex);
        if (result.rowIndex !== null) setExpandedIndex(result.rowIndex);
      } else {
        onSuccess(rows.length);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 px-4 py-3">
        <DrawerClose asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("aria.close")}>
            <XIcon />
          </Button>
        </DrawerClose>
        <div className="flex min-w-0 flex-col">
          <DrawerTitle>{t("batch.mobile.title")}</DrawerTitle>
          <span className="text-xs text-muted-foreground">
            {t("batch.mobile.subtitle", { count: rows.length })}
          </span>
        </div>
      </header>

      <div className="flex shrink-0 flex-col gap-2 border-y border-border bg-muted/30 px-4 py-3">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {t("batch.mobile.appliesToAll")}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <ChipSelect
            label={t("batch.columns.account")}
            value={accountId}
            onChange={setAccountId}
            options={debitAccounts.map((account) => ({
              value: account.id,
              label: account.name,
            }))}
            isInvalid={!accountId}
            sheetTitle={t("batch.columns.account")}
          />
          <DateChipSelect
            label={t("batch.columns.date")}
            value={date}
            onChange={setDate}
            isInvalid={!date}
            sheetTitle={t("batch.columns.date")}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
        {rows.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {t("batch.mobile.empty")}
          </p>
        )}

        {rows.map((row, index) => {
          const isExpanded = expandedIndex === index;
          const ready = isRowReady(row);
          const amount = resolveAmount(row.amount);
          const signedAmount =
            amount === null ? null : row.type === "expense" ? -amount : amount;
          const category = categories.find((c) => c.id === row.categoryId);

          return (
            <div
              key={index}
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-3",
                isExpanded
                  ? "border-primary bg-primary/5"
                  : errorRowIndex === index
                    ? "border-destructive/50 bg-destructive/5"
                    : "border-border",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums",
                    isExpanded
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm font-medium",
                      !row.description.trim() && "text-muted-foreground",
                    )}
                  >
                    {row.description.trim() || t("fields.description.label")}
                  </span>
                  {signedAmount !== null && (
                    <span
                      className={cn(
                        "shrink-0 text-sm font-semibold tabular-nums",
                        signedAmount < 0 ? "text-negative" : "text-positive",
                      )}
                    >
                      {money(signedAmount)}
                    </span>
                  )}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => handleDeleteRow(index)}
                >
                  <TrashIcon />
                  <span className="sr-only">{t("batch.removeRow")}</span>
                </Button>
              </div>

              {isExpanded ? (
                <BatchRowFields
                  // Keyed by position so moving between rows remounts the
                  // editor and re-derives its divide-with-people toggle
                  // from the row it is handed.
                  key={index}
                  value={row}
                  onChange={(patch) => patchRow(index, patch)}
                  accounts={debitAccounts}
                  categories={categories}
                  people={people}
                  showAccountChip={false}
                  showDateChip={false}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 pl-8.5">
                  {category && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {createElement(resolveCategoryIcon(category.icon), {
                        className: "size-3",
                      })}
                      {category.name}
                    </span>
                  )}
                  {row.paymentMethod && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {t(`fields.paymentMethod.${row.paymentMethod}`)}
                    </span>
                  )}
                  {!ready && (
                    <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
                      {t("batch.mobile.rowIncomplete")}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleAddRow}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-primary transition-colors hover:bg-accent/50"
        >
          <PlusIcon className="size-4" />
          {t("batch.mobile.addRow")}
        </button>
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-border p-4">
        <FormError title={t("toast.error")} description={serverError} />

        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {t("batch.mobile.readyRows", { count: readyCount })}
            </span>
            <span
              className={cn(
                "text-lg font-semibold tabular-nums",
                total < 0 ? "text-negative" : "text-positive",
              )}
            >
              {money(total)}
            </span>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? (
            <SpinnerIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          {t("batch.mobile.submitCount", { count: rows.length })}
        </Button>
      </div>
    </form>
  );
}
