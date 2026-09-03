"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AmountInput } from "@/components/form/amount-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatPersonName } from "@/lib/format-person-name";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import {
  paymentMethodFormValues,
  transactionTypeValues,
  type BatchRowFormValues,
} from "../../_schema/schema";
import {
  centsToAmountString,
  parseAmountLoose,
  resolveAmount,
  toCents,
} from "../../_lib/batch-amounts";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
} from "../../_types/types";
import { ChipSelect, DateChipSelect } from "./chip-select";
import { CreatePersonInline } from "./create-person-inline";

type BatchRowFieldsProps = {
  value: BatchRowFormValues;
  onChange: (patch: Partial<BatchRowFormValues>) => void;
  // Already narrowed to the accounts a debit batch may target — the
  // caller owns that filter (see BatchTransactionTable's own comment on
  // why cards and investment accounts are excluded).
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  // The mobile screen hoists account and date into a single "applies to
  // every row" header, so it hides both chips here rather than repeating
  // them inside each row.
  showAccountChip?: boolean;
  showDateChip?: boolean;
};

// Everything involved in editing ONE batch row: the type toggle,
// description/amount, the chip row, and the "divide with other people"
// card along with its split arithmetic. Extracted from
// BatchTransactionTable so the mobile batch screen edits a row through
// exactly the same fields and the same math instead of a third
// hand-written copy of it.
//
// Callers mount this with a `key` tied to the row being edited: the
// split effects below are written against a single row's lifetime, and
// remounting per row is what re-arms `isFirstTotalRender` naturally
// (the table used to have to reset that ref by hand on every edit).
export function BatchRowFields({
  value,
  onChange,
  accounts,
  categories,
  people,
  showAccountChip = true,
  showDateChip = true,
}: BatchRowFieldsProps) {
  const t = useTranslations("scrn-transactions");
  const format = useFormatter();

  // Derived from the row itself on mount rather than tracked by the
  // caller: a row with splits is by definition one that was divided.
  const [isDividing, setIsDividing] = useState(() => value.splits.length > 0);

  // Only categories matching the row's own type — same rule the
  // single-transaction forms' pickers follow.
  const categoryType = value.type === "income" ? "INCOME" : "EXPENSE";
  const filteredCategories = categories.filter(
    (category) => category.type === categoryType,
  );

  function patch(next: Partial<BatchRowFormValues>) {
    // The category picker is scoped to the row's own type — switching
    // type drops a categoryId that no longer matches, same "dependent
    // field reset" the credit batch table does for cardId.
    if (next.type !== undefined && next.type !== value.type) {
      const nextCategoryType = next.type === "income" ? "INCOME" : "EXPENSE";
      const category = categories.find((c) => c.id === value.categoryId);
      if (category && category.type !== nextCategoryType) {
        onChange({ ...next, categoryId: "" });
        return;
      }
    }
    onChange(next);
  }

  // --- Person split math (identical to debit-transaction-form.tsx's own,
  // adapted from TanStack Form field ops to plain value/onChange) -------
  const splits = value.splits;
  const secondaries = splits.slice(1);
  const totalCents = toCents(resolveAmount(value.amount));
  const secondaryCentsList = secondaries.map((split) =>
    toCents(parseAmountLoose(split.amount)),
  );
  const secondaryCentsSum = secondaryCentsList.reduce((sum, c) => sum + c, 0);
  const primaryAmountCents = totalCents - secondaryCentsSum;
  const primaryAmountDisplay = centsToAmountString(
    Math.max(primaryAmountCents, 0),
  );
  const isOverAllocated = primaryAmountCents < 0;
  const primaryPerson = people.find((person) => person.id === value.personId);
  const sign = value.type === "expense" ? -1 : 1;

  useEffect(() => {
    if (isDividing) {
      if (splits.length === 0) {
        patch({
          splits: [
            { personId: value.personId, amount: centsToAmountString(totalCents) },
          ],
        });
      }
    } else if (splits.length > 0) {
      patch({ splits: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDividing]);

  useEffect(() => {
    if (!isDividing) return;
    if (splits[0]?.personId !== value.personId) {
      patch({
        splits: splits.map((s, i) =>
          i === 0 ? { ...s, personId: value.personId } : s,
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.personId, isDividing]);

  useEffect(() => {
    if (!isDividing) return;
    const next = centsToAmountString(primaryAmountCents);
    if (splits[0]?.amount !== next) {
      patch({
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
    patch({
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
        patch({
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
      patch({
        splits: [...redistributed, { personId: newPersonId, amount: shareAfterStr }],
      });
    } else {
      patch({ splits: [...splits, { personId: newPersonId, amount: "0,00" }] });
    }
  }

  function handleRemoveSecondary(index: number) {
    patch({ splits: splits.filter((_, i) => i !== index) });
  }

  return (
    <>
      <ToggleGroup
        type="single"
        variant="tabs"
        value={value.type}
        onValueChange={(next) => {
          if (next) patch({ type: next as BatchRowFormValues["type"] });
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
          value={value.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder={t("fields.description.placeholder")}
        />
        <AmountInput
          className="w-28"
          value={value.amount}
          onChange={(next) => patch({ amount: next })}
          placeholder={t("fields.amount.placeholder")}
          allowExpression
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {showDateChip && (
          <DateChipSelect
            label={t("batch.columns.date")}
            value={value.date}
            onChange={(next) => patch({ date: next })}
            sheetTitle={t("batch.columns.date")}
          />
        )}
        {showAccountChip && (
          <ChipSelect
            label={t("batch.columns.account")}
            value={value.accountId}
            onChange={(next) => patch({ accountId: next })}
            options={accounts.map((account) => ({
              value: account.id,
              label: account.name,
            }))}
            sheetTitle={t("batch.columns.account")}
          />
        )}
        <ChipSelect
          label={t("batch.columns.paymentMethod")}
          value={value.paymentMethod}
          onChange={(next) => patch({ paymentMethod: next })}
          options={paymentMethodFormValues.map((method) => ({
            value: method,
            label: t(`fields.paymentMethod.${method}`),
          }))}
          sheetTitle={t("batch.columns.paymentMethod")}
        />
        <ChipSelect
          label={t("batch.columns.category")}
          value={value.categoryId}
          onChange={(next) => patch({ categoryId: next })}
          options={filteredCategories.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
          sheetTitle={t("batch.columns.category")}
        />
        {/* Only worth asking "who's this for" once there's more than
            just you — see debit-transaction-form.tsx's own comment on
            the same field. */}
        {people.length > 1 && (
          <ChipSelect
            label={t("batch.columns.person")}
            value={value.personId}
            onChange={(next) => patch({ personId: next })}
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
                  onCreated={(person) => patch({ personId: person.id })}
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
          already-dense editor. Same "only worth it with someone else to
          split with" gating as the Pessoa chip above. */}
      {people.length > 1 && (
        <div className="flex flex-col gap-2 rounded-md border border-border/60 p-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium">{t("splits.toggleLabel")}</p>
              {!value.personId && (
                <p className="text-[11px] text-muted-foreground">
                  {t("splits.needsPersonFirst")}
                </p>
              )}
            </div>
            <Switch
              checked={isDividing}
              onCheckedChange={setIsDividing}
              disabled={!value.personId}
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
                <p className="text-[11px] text-negative">
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
                      onChange={(next) =>
                        patch({
                          splits: splits.map((s, si) =>
                            si === index ? { ...s, personId: next } : s,
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
                      onChange={(next) =>
                        patch({
                          splits: splits.map((s, si) =>
                            si === index ? { ...s, amount: next } : s,
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
    </>
  );
}
