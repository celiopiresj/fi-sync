"use client";

import { useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormError } from "@/components/form/form-error";
import { cn } from "@/lib/utils";
import { parseLocalCalendarDate } from "@/lib/date";
import { formatPersonName } from "@/lib/format-person-name";
import {
  ArrowLeftIcon,
  CheckIcon,
  PencilSimpleIcon,
  SpinnerIcon,
} from "@phosphor-icons/react";
import { resolveAmount } from "../../_lib/batch-amounts";
import type { CategoryOption, PersonOption } from "../../_types/types";
import { ChipSelect } from "../form/chip-select";
import { ImportStepHeader } from "./import-step-header";

// The fields the review chrome itself reads/writes on a row, present on
// both batch row shapes (`BatchRowFormValues` and
// `CreditBatchRowFormValues`). Everything past this — payment method,
// card, installments, splits — is the caller's business, rendered
// through `renderFields`.
export type ImportedRowCommon = {
  description: string;
  amount: string;
  type: "income" | "expense";
  date: string;
  categoryId: string;
  personId: string;
};

type ImportReviewStepProps<T extends ImportedRowCommon> = {
  initialRows: T[];
  categories: CategoryOption[];
  people: PersonOption[];
  // Name of the card/account every row lands on, chosen before the file
  // was attached — shown, not editable, with `onBack` to change it.
  destinationLabel: string;
  onBack: () => void;
  // Container-supplied chrome — see ImportStepHeader.
  title: string | null;
  onClose?: () => void;
  isRowReady: (row: T) => boolean;
  renderFields: (row: T, patch: (patch: Partial<T>) => void) => ReactNode;
  // Extra pills for a collapsed row (the fatura import uses it for
  // "3x", the parcelamento it rebuilt) — the shared ones (date,
  // category, person) are rendered here.
  renderBadges?: (row: T) => ReactNode;
  onSubmit: (rows: T[]) => Promise<{ error: string | null; rowIndex: number | null }>;
  onSuccess: (count: number) => void;
};

// The second half of the import: what the file turned into, as batch
// rows the user checks off. Generic over the row shape because a fatura
// and an extrato produce genuinely different rows (card + parcelas vs.
// payment method) but the exact same review interaction — a checklist
// with an expandable editor — and writing that chrome twice is how the
// two would drift apart on which rows count as ready.
//
// Rows are never deleted, only unchecked: the indexes stay aligned with
// what the model read, so `rowIndex` coming back from a failed batch
// still points at the row the user is looking at.
export function ImportReviewStep<T extends ImportedRowCommon>({
  initialRows,
  categories,
  people,
  destinationLabel,
  onBack,
  title,
  onClose,
  isRowReady,
  renderFields,
  renderBadges,
  onSubmit,
  onSuccess,
}: ImportReviewStepProps<T>) {
  const t = useTranslations("scrn-transactions");
  const format = useFormatter();

  const [rows, setRows] = useState<T[]>(initialRows);
  // Everything the file produced starts checked — the common case is
  // importing the whole statement, and unchecking the two lines that
  // don't belong is less work than checking forty that do.
  const [selected, setSelected] = useState<boolean[]>(() =>
    initialRows.map(() => true),
  );
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [errorRowIndex, setErrorRowIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The spread widens T to a plain object as far as TypeScript is
  // concerned, hence the assertion — the runtime value is still a full
  // row, since `patch` only ever carries keys of T.
  function patchRow(index: number, patch: Partial<T>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? ({ ...row, ...patch } as T) : row)),
    );
  }

  // "Aplicar a todas" only offers the two fields no statement can ever
  // supply — a document knows what was bought, never which category it
  // belongs to or who it was for. They're also the two that would
  // otherwise be re-picked forty times in a row.
  //
  // `onlyType` is what keeps the category chip honest: every row-level
  // category picker in this app is scoped to the row's own type, so
  // applying "Mercado" (an EXPENSE category) to all would otherwise be
  // the one path that lands it on the estorno row too.
  function patchAll(
    patch: Partial<ImportedRowCommon>,
    onlyType?: "income" | "expense",
  ) {
    setRows((current) =>
      current.map((row) =>
        onlyType && row.type !== onlyType ? row : ({ ...row, ...patch } as T),
      ),
    );
  }

  function toggleRow(index: number) {
    setSelected((current) =>
      current.map((value, i) => (i === index ? !value : value)),
    );
  }

  const selectedRows = rows.filter((_, index) => selected[index]);
  const selectedCount = selectedRows.length;
  const allSelected = selectedCount === rows.length && rows.length > 0;
  // A checked row that is still missing a field blocks the submit —
  // unchecking it is the way out, same as fixing it.
  const canSubmit = selectedCount > 0 && selectedRows.every(isRowReady);

  const total = selectedRows.reduce((sum, row) => {
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
      const result = await onSubmit(selectedRows);
      if (result.error) {
        setServerError(result.error);
        // `rowIndex` counts within what was submitted, not within every
        // row on screen — map it back so the highlighted row is the one
        // the server actually rejected.
        const submittedIndexes = rows
          .map((_, index) => index)
          .filter((index) => selected[index]);
        const screenIndex =
          result.rowIndex === null ? null : (submittedIndexes[result.rowIndex] ?? null);
        setErrorRowIndex(screenIndex);
        if (screenIndex !== null) setExpandedIndex(screenIndex);
      } else {
        onSuccess(selectedCount);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <ImportStepHeader
        title={title === null ? null : t("import.review.title")}
        subtitle={t("import.review.subtitle", { count: rows.length })}
        onClose={onClose}
      />

      <div className="flex shrink-0 flex-col gap-2 border-y border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {t("import.review.destination")}:{" "}
            <span className="font-medium text-foreground">{destinationLabel}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={onBack}
          >
            <ArrowLeftIcon />
            {t("import.file.back")}
          </Button>
        </div>

        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {t("import.review.applyToAll")}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <ChipSelect
            label={t("batch.columns.category")}
            value=""
            onChange={(next) =>
              patchAll(
                { categoryId: next },
                categories.find((category) => category.id === next)?.type ===
                  "INCOME"
                  ? "income"
                  : "expense",
              )
            }
            options={categories.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
            sheetTitle={t("batch.columns.category")}
          />
          <ChipSelect
            label={t("batch.columns.person")}
            value=""
            onChange={(next) => patchAll({ personId: next })}
            options={people.map((person) => ({
              value: person.id,
              label: person.name,
            }))}
            formatDisplay={formatPersonName}
            sheetTitle={t("batch.columns.person")}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setSelected(rows.map(() => !allSelected))}
          >
            {allSelected
              ? t("import.review.clearAll")
              : t("import.review.selectAll")}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
        {rows.map((row, index) => {
          const isExpanded = expandedIndex === index;
          const isSelected = selected[index];
          const ready = isRowReady(row);
          const amount = resolveAmount(row.amount);
          const signedAmount =
            amount === null ? null : row.type === "expense" ? -amount : amount;
          const parsedDate = parseLocalCalendarDate(row.date);
          const category = categories.find((c) => c.id === row.categoryId);
          const person = people.find((p) => p.id === row.personId);

          return (
            <div
              key={index}
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-3 transition-opacity",
                isExpanded
                  ? "border-primary bg-primary/5"
                  : errorRowIndex === index
                    ? "border-destructive/50 bg-destructive/5"
                    : "border-border",
                !isSelected && "opacity-50",
              )}
            >
              <div className="flex items-center gap-2.5">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleRow(index)}
                  aria-label={row.description}
                  className="shrink-0"
                />
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
                {/* The whole row is already the hit area, but nothing
                    about a description and an amount says "tap me to
                    edit" — this is the affordance, same pencil the batch
                    table's queued rows use. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label={t("batch.editRow")}
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                >
                  {isExpanded ? <CheckIcon /> : <PencilSimpleIcon />}
                </Button>
              </div>

              {isExpanded ? (
                <div className="flex flex-col gap-2">
                  {renderFields(row, (patch) => patchRow(index, patch))}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 pl-6.5">
                  {parsedDate && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {format.dateTime(parsedDate, { dateStyle: "short" })}
                    </span>
                  )}
                  {renderBadges?.(row)}
                  {category && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {category.name}
                    </span>
                  )}
                  {person && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {formatPersonName(person.name)}
                    </span>
                  )}
                  {isSelected && !ready && (
                    <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
                      {t("import.review.rowIncomplete")}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-border p-4">
        <FormError title={t("toast.error")} description={serverError} />

        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {t("import.review.selected", { count: selectedCount })}
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
          {t("import.review.submit", { count: selectedCount })}
        </Button>
      </div>
    </form>
  );
}
