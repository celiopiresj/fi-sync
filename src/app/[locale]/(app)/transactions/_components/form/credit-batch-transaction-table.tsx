"use client";

import { AmountInput } from "@/components/form/amount-field";
import { FormError } from "@/components/form/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DATE_ONLY_FORMAT_OPTIONS,
  parseLocalCalendarDate,
  todayCalendarDate,
} from "@/lib/date";
import { formatPersonName } from "@/lib/format-person-name";
import {
  evaluateExpression,
  isCompoundExpression,
} from "@/lib/math/safe-expression";
import { PencilSimpleIcon, SpinnerIcon, TrashIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  emptyCreditBatchRow,
  installmentAmountModeValues,
  transactionTypeValues,
  type CreditBatchRowFormValues,
} from "../../_schema/schema";
import {
  previewInvoiceCycle,
  previewCurrentInvoiceCycle,
  previewInstallmentCycles,
} from "../../actions";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
} from "../../_types/types";
import { ChipSelect, DateChipSelect } from "./chip-select";
import { CreatePersonInline } from "./create-person-inline";
import { PastInstallmentsDialog } from "./past-installments-dialog";

// Same fixed 1–24 range the single-form's own installments field allows
// in practice (no hard cap there, but no card realistically bills more)
// — a ChipSelect needs a bounded option list, unlike the free-typed
// TextField the single form uses.
const INSTALLMENT_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i + 1));

// A fresh row defaulting to today and to `defaultPersonId` — same
// reasoning as debit's own makeEmptyRow in batch-transaction-table.tsx.
function makeEmptyRow(defaultPersonId: string | null): CreditBatchRowFormValues {
  return {
    ...emptyCreditBatchRow,
    date: todayCalendarDate(),
    personId: defaultPersonId ?? "",
  };
}

// Resolves the draft's typed amount (comma/period decimals, or an
// expression like "120+35") to a plain positive number, or null if it
// isn't one yet — identical to debit's own resolveAmount.
function resolveAmount(raw: string): number | null {
  const evaluated = isCompoundExpression(raw) ? evaluateExpression(raw) : null;
  const parsed = evaluated ?? (raw ? Number(raw.replace(",", ".")) : NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type CreditBatchTransactionTableProps = {
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  defaultPersonId: string | null;
  onSubmit: (
    rows: CreditBatchRowFormValues[],
  ) => Promise<{ error: string | null; rowIndex: number | null }>;
  onSuccess: (count: number) => void;
};

export function CreditBatchTransactionTable({
  accounts,
  categories,
  people,
  defaultPersonId,
  onSubmit,
  onSuccess,
}: CreditBatchTransactionTableProps) {
  const t = useTranslations("scrn-transactions");
  const format = useFormatter();

  const [draft, setDraft] = useState<CreditBatchRowFormValues>(() =>
    makeEmptyRow(defaultPersonId),
  );
  const [draftError, setDraftError] = useState<string | null>(null);
  // Index into `queue` while editing an existing item (pencil icon) —
  // null means the draft form is building a brand-new entry.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [queue, setQueue] = useState<CreditBatchRowFormValues[]>([]);
  // Set (instead of committing straight to `queue`) when handleAddOrSave
  // finds this row's first installment already past due — see
  // PastInstallmentsDialog's own doc comment.
  const [pastInstallmentsValue, setPastInstallmentsValue] =
    useState<CreditBatchRowFormValues | null>(null);

  const [serverError, setServerError] = useState<string | null>(null);
  const [errorRowIndex, setErrorRowIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedAccount = accounts.find((account) => account.id === draft.accountId);
  const activeCards = (selectedAccount?.cards ?? []).filter(
    (card) => card.status === "ACTIVE" || card.id === draft.cardId,
  );

  // Same "titular defaults in" behavior as credit-transaction-form.tsx's
  // own effect (see its comment) — the Portador chip below only shows up
  // once there's more than the titular's own card, so this is what keeps
  // cardId populated for the common single-card case.
  useEffect(() => {
    if (!selectedAccount) return;
    if (draft.cardId && selectedAccount.cards.some((card) => card.id === draft.cardId)) {
      return;
    }
    const primaryCard = selectedAccount.cards[0];
    if (primaryCard) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft((current) => ({ ...current, cardId: primaryCard.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.accountId]);

  // Only categories matching the draft row's own type — same rule the
  // single-transaction forms' pickers follow.
  const categoryType = draft.type === "income" ? "INCOME" : "EXPENSE";
  const filteredCategories = categories.filter(
    (category) => category.type === categoryType,
  );

  // Same "cai na fatura que fecha em X" (+ "na fatura atual seria a
  // parcela N de M") preview as credit-transaction-form.tsx's own — a
  // batch row backdating an installment purchase needs the same context
  // for where it actually lands, not just the typed installment count.
  const installmentCount = Number(draft.installments || "1");
  const { data: invoicePreview } = useQuery({
    queryKey: ["credit-batch-invoice-preview", draft.accountId, draft.date],
    queryFn: () => previewInvoiceCycle(draft.accountId, draft.date),
    enabled: Boolean(draft.accountId) && Boolean(draft.date),
  });
  const installmentCyclesQuery = useQuery({
    queryKey: [
      "credit-batch-installment-cycles",
      draft.accountId,
      draft.date,
      installmentCount,
    ],
    queryFn: () =>
      previewInstallmentCycles(draft.accountId, draft.date, installmentCount),
    enabled:
      Boolean(draft.accountId) && Boolean(draft.date) && installmentCount > 1,
  });
  const { data: currentInvoiceCycle } = useQuery({
    queryKey: ["credit-batch-current-invoice-cycle", draft.accountId],
    queryFn: () => previewCurrentInvoiceCycle(draft.accountId),
    enabled: Boolean(draft.accountId) && installmentCount > 1,
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

  // Feeds the past-due-installments check in handleAddOrSave below — same
  // "only the ones still ahead count as upcoming" rule as
  // credit-transaction-form.tsx's own (see its matching comment). A batch
  // row is always a fresh create (never editing an existing installment
  // 1), so unlike the single form there's no slice(1) offset needed here.
  const firstNewInstallmentCycle = installmentCyclesQuery.data?.[0];
  const upcomingInstallmentsCount =
    installmentCyclesQuery.data?.filter(
      (cycle) => new Date(cycle.dueDate) >= new Date(todayCalendarDate()),
    ).length ?? 0;
  // handleAddOrSave's past-due check only runs when
  // firstNewInstallmentCycle is already resolved — clicking "Adicionar"
  // before this query settles would silently skip straight past that
  // check instead of waiting for it, committing the row as if it had
  // none of its installments already due. Disables the button for
  // exactly that window.
  const isCalculatingInstallments =
    installmentCount > 1 &&
    (installmentCyclesQuery.isFetching || !installmentCyclesQuery.data);

  function patchDraft(patch: Partial<CreditBatchRowFormValues>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      // The card picker's options depend on which account is selected —
      // switching accounts mid-draft drops a cardId that no longer
      // belongs to the new account, same as the single form's own
      // selectedAccount-scoped card list.
      if (patch.accountId !== undefined && patch.accountId !== current.accountId) {
        next.cardId = "";
      }
      // The category picker is scoped to the row's own type (see
      // filteredCategories above) — switching type drops a categoryId
      // that no longer matches.
      if (patch.type !== undefined && patch.type !== current.type) {
        const nextCategoryType = patch.type === "income" ? "INCOME" : "EXPENSE";
        const category = categories.find((c) => c.id === current.categoryId);
        if (category && category.type !== nextCategoryType) next.categoryId = "";
      }
      return next;
    });
  }

  // Actually commits a resolved snapshot to the queue — shared by the
  // normal path below and by PastInstallmentsDialog's own two choices
  // (each just picks a different `skipPastInstallments` on the snapshot
  // first).
  function commitRow(snapshot: CreditBatchRowFormValues) {
    if (editingIndex !== null) {
      setQueue((current) =>
        current.map((row, i) => (i === editingIndex ? snapshot : row)),
      );
      setEditingIndex(null);
    } else {
      setQueue((current) => [...current, snapshot]);
    }

    // Chips "remember" their last value for the next entry — only
    // description/amount reset, same convention as debit's own batch.
    setDraft({ ...snapshot, description: "", amount: "" });
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
            ? t("fields.card.label")
            : !draft.cardId
              ? t("fields.card.holderLabel")
              : !draft.categoryId
                ? t("fields.category.label")
                : !draft.personId
                  ? t("fields.person.label")
                  : null;

    if (missingLabel || resolved === null) {
      setDraftError(t("batch.missingField", { field: missingLabel ?? "" }));
      return;
    }
    setDraftError(null);

    // The queue stores a resolved, fixed snapshot — editing the draft's
    // chips afterward (building the next entry) never reaches back into
    // an already-queued item.
    const snapshot: CreditBatchRowFormValues = {
      ...draft,
      amount: resolved.toFixed(2).replace(".", ","),
    };

    // Same check as credit-transaction-form.tsx's own onSubmit — asks
    // instead of silently backdating a pile of already-due installments.
    const installmentCount = Number(snapshot.installments || "1");
    if (
      installmentCount > 1 &&
      firstNewInstallmentCycle &&
      new Date(firstNewInstallmentCycle.dueDate) < new Date(todayCalendarDate())
    ) {
      setPastInstallmentsValue(snapshot);
      return;
    }

    commitRow(snapshot);
  }

  function handleEdit(index: number) {
    setDraft(queue[index]);
    setEditingIndex(index);
    setDraftError(null);
  }

  function handleCancelEdit() {
    setEditingIndex(null);
    setDraft((current) => ({ ...current, description: "", amount: "" }));
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

  function subtitleFor(row: CreditBatchRowFormValues): string {
    const parsedDate = parseLocalCalendarDate(row.date);
    const account = accounts.find((a) => a.id === row.accountId);
    const card = account?.cards.find((c) => c.id === row.cardId);
    const installmentCount = Number(row.installments || "1");
    const parts = [
      parsedDate ? format.dateTime(parsedDate, { dateStyle: "short" }) : null,
      account?.name,
      // Only worth naming the specific card when the account actually has
      // more than one — same gating as the Portador chip above, so a
      // single-card account's card name (which mirrors the account's own
      // name) doesn't show up twice.
      (account?.cards.length ?? 0) > 1 ? card?.name : null,
      categories.find((c) => c.id === row.categoryId)?.name,
      installmentCount > 1
        ? t("fields.installments.optionLabel", { count: installmentCount })
        : null,
      (() => {
        const person = people.find((p) => p.id === row.personId);
        return person ? formatPersonName(person.name) : null;
      })(),
    ];
    return parts.filter(Boolean).join(" · ");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{t("batch.title")}</p>
        <p className="text-xs text-muted-foreground">{t("batch.description")}</p>
      </div>

        <div className="flex flex-col gap-3 rounded-lg border border-primary/40 p-3">
          {editingIndex !== null && (
            <p className="text-xs font-medium text-primary">{t("batch.editingRow")}</p>
          )}

          <ToggleGroup
            type="single"
            variant="tabs"
            value={draft.type}
            onValueChange={(value) => {
              if (value) patchDraft({ type: value as CreditBatchRowFormValues["type"] });
            }}
            className="w-full">
            {transactionTypeValues.map((type) => (
              <ToggleGroupItem key={type} value={type} className="flex-1">
                {t(type === "income" ? "fields.type.creditIncome" : `fields.type.${type}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="flex gap-2">
            <Input
              className="flex-1"
              value={draft.description}
              onChange={(e) => patchDraft({ description: e.target.value })}
              placeholder={t("fields.description.placeholderCredit")}
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
              label={t("fields.card.label")}
              value={draft.accountId}
              onChange={(value) => patchDraft({ accountId: value })}
              options={accounts.map((account) => ({
                value: account.id,
                label: account.name,
              }))}
              sheetTitle={t("fields.card.label")}
            />
            {/* Only worth asking "which card" once there's more than the
                titular's own — same rule the single credit form's own
                Portador chip follows (see its comment there). The
                default-cardId effect above already keeps the titular
                selected either way. */}
            {activeCards.length > 1 && (
              <ChipSelect
                label={t("fields.card.holderLabel")}
                value={draft.cardId}
                onChange={(value) => patchDraft({ cardId: value })}
                options={activeCards.map((card) => ({
                  value: card.id,
                  label: card.lastFourDigits
                    ? `${card.name} •••• ${card.lastFourDigits}`
                    : card.name,
                }))}
                sheetTitle={t("fields.card.holderLabel")}
              />
            )}
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
            <ChipSelect
              label={t("batch.columns.installments")}
              value={draft.installments}
              onChange={(value) => patchDraft({ installments: value })}
              options={INSTALLMENT_OPTIONS.map((count) => ({
                value: count,
                label: t("fields.installments.optionLabel", { count: Number(count) }),
              }))}
              sheetTitle={t("batch.columns.installments")}
            />
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

          {/* Compact counterpart of the single credit form's own
              installmentAmountMode ToggleGroupField — same "total vs.
              per-installment" choice, just a plain ToggleGroup here since
              the draft isn't backed by a TanStack Form instance. */}
          {installmentCount > 1 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t("fields.installmentAmountMode.label")}
              </span>
              <ToggleGroup
                type="single"
                variant="tabs"
                value={draft.installmentAmountMode}
                onValueChange={(value) => {
                  if (value) {
                    patchDraft({
                      installmentAmountMode:
                        value as CreditBatchRowFormValues["installmentAmountMode"],
                    });
                  }
                }}
                className="w-full"
              >
                {installmentAmountModeValues.map((mode) => (
                  <ToggleGroupItem key={mode} value={mode} className="flex-1 text-xs">
                    {t(`fields.installmentAmountMode.${mode}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {draft.installmentAmountMode === "perInstallment" &&
                resolveAmount(draft.amount) !== null && (
                  <p className="text-[11px] text-muted-foreground">
                    {t("fields.installmentAmountMode.totalPreview", {
                      value: format.number(
                        resolveAmount(draft.amount)! * installmentCount,
                        { style: "currency", currency: "BRL" },
                      ),
                    })}
                  </p>
                )}
            </div>
          )}

          {invoicePreview && (
            <p className="text-[11px] text-muted-foreground">
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

          {draftError && (
            <p className="text-xs text-red-600 dark:text-red-400">{draftError}</p>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleAddOrSave}
              disabled={isCalculatingInstallments}
              className="flex-1"
            >
              {isCalculatingInstallments && (
                <SpinnerIcon className="size-4 animate-spin" />
              )}
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
                    <span className="truncate text-sm font-medium">{row.description}</span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {subtitleFor(row)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-sm font-medium tabular-nums">
                      {format.number(sign * Number(row.amount.replace(",", ".")), {
                        style: "currency",
                        currency: "BRL",
                      })}
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
                  {format.number(totals.income, { style: "currency", currency: "BRL" })}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("batch.totalExpense")}</span>
                <span className="tabular-nums text-negative">
                  {format.number(-totals.expense, { style: "currency", currency: "BRL" })}
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm font-medium">
                <span>{t("batch.netTotal")}</span>
                <span className="tabular-nums">
                  {format.number(totals.net, { style: "currency", currency: "BRL" })}
                </span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-sm font-medium">
              <span>{t("batch.total")}</span>
              <span className="tabular-nums">
                {format.number(totals.hasIncome ? totals.income : -totals.expense, {
                  style: "currency",
                  currency: "BRL",
                })}
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

      {pastInstallmentsValue && firstNewInstallmentCycle && (
        <PastInstallmentsDialog
          open
          onOpenChange={(open) => {
            if (!open) setPastInstallmentsValue(null);
          }}
          firstDueDate={new Date(firstNewInstallmentCycle.dueDate)}
          totalInstallments={Number(pastInstallmentsValue.installments || "1")}
          upcomingInstallments={upcomingInstallmentsCount}
          isSubmitting={false}
          onAddAll={() => {
            commitRow({ ...pastInstallmentsValue, skipPastInstallments: false });
            setPastInstallmentsValue(null);
          }}
          onAddUpcoming={() => {
            commitRow({ ...pastInstallmentsValue, skipPastInstallments: true });
            setPastInstallmentsValue(null);
          }}
        />
      )}
    </form>
  );
}
