"use client";

import { useTranslations } from "next-intl";
import { AmountInput } from "@/components/form/amount-field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatPersonName } from "@/lib/format-person-name";
import {
  transactionTypeValues,
  type CreditBatchRowFormValues,
} from "../../_schema/schema";
import { INSTALLMENT_OPTIONS } from "../../_constants/constants";
import type {
  CardOption,
  CategoryOption,
  PersonOption,
} from "../../_types/types";
import { ChipSelect, DateChipSelect } from "../form/chip-select";
import { CreatePersonInline } from "../form/create-person-inline";

type ImportCreditRowFieldsProps = {
  value: CreditBatchRowFormValues;
  onChange: (patch: Partial<CreditBatchRowFormValues>) => void;
  // Already narrowed to the chosen account's active cards — the account
  // itself is fixed for the whole import (picked before the file was
  // attached), so there is no Conta chip here.
  cards: CardOption[];
  categories: CategoryOption[];
  people: PersonOption[];
};

// Credit counterpart of BatchRowFields (form/batch-row-fields.tsx), for
// one row read out of a fatura. Same chips and the same schema as the
// credit batch table's draft card, minus everything that only makes
// sense while typing a purchase by hand: no Conta chip (the import has
// one destination), and no invoice-cycle preview queries — an imported
// row already carries the date the fatura reported, so there is nothing
// to predict, and firing three queries per row would mean dozens of
// round-trips for one file.
//
// No "dividir com outras pessoas" block either, unlike the debit row
// editor: `creditBatchRowSchema` carries no splits at all (see its
// comment), so a card purchase is attributed to one person here and
// divided later by editing the transaction.
export function ImportCreditRowFields({
  value,
  onChange,
  cards,
  categories,
  people,
}: ImportCreditRowFieldsProps) {
  const t = useTranslations("scrn-transactions");

  // Only categories matching the row's own type — same rule every other
  // picker in this screen follows.
  const categoryType = value.type === "income" ? "INCOME" : "EXPENSE";
  const filteredCategories = categories.filter(
    (category) => category.type === categoryType,
  );

  function patch(next: Partial<CreditBatchRowFormValues>) {
    // The category picker is scoped to the row's type — switching type
    // drops a categoryId that no longer matches, same dependent-field
    // reset as the credit batch table's own patchDraft.
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

  return (
    <>
      <ToggleGroup
        type="single"
        variant="tabs"
        value={value.type}
        onValueChange={(next) => {
          if (next) patch({ type: next as CreditBatchRowFormValues["type"] });
        }}
        className="w-full"
      >
        {transactionTypeValues.map((type) => (
          <ToggleGroupItem key={type} value={type} className="flex-1">
            {t(
              type === "income"
                ? "fields.type.creditIncome"
                : `fields.type.${type}`,
            )}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex gap-2">
        <Input
          className="flex-1"
          value={value.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder={t("fields.description.placeholderCredit")}
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
        <DateChipSelect
          label={t("batch.columns.date")}
          value={value.date}
          onChange={(next) => patch({ date: next })}
          sheetTitle={t("batch.columns.date")}
        />
        <ChipSelect
          label={t("fields.installments.label")}
          value={value.installments}
          onChange={(next) => patch({ installments: next })}
          options={INSTALLMENT_OPTIONS.map((count) => ({
            value: count,
            label: t("fields.installments.optionLabel", {
              count: Number(count),
            }),
          }))}
          sheetTitle={t("fields.installments.label")}
        />
        {/* Only worth asking "which card" once the account has more than
            the titular's own — same gating as the credit forms' own
            Portador chip. */}
        {cards.length > 1 && (
          <ChipSelect
            label={t("fields.card.holderLabel")}
            value={value.cardId}
            onChange={(next) => patch({ cardId: next })}
            options={cards.map((card) => ({ value: card.id, label: card.name }))}
            sheetTitle={t("fields.card.holderLabel")}
          />
        )}
        <ChipSelect
          label={t("batch.columns.category")}
          value={value.categoryId}
          onChange={(next) => patch({ categoryId: next })}
          options={filteredCategories.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
          isInvalid={!value.categoryId}
          sheetTitle={t("batch.columns.category")}
        />
        <ChipSelect
          label={t("batch.columns.person")}
          value={value.personId}
          onChange={(next) => patch({ personId: next })}
          options={people.map((person) => ({
            value: person.id,
            label: person.name,
          }))}
          formatDisplay={formatPersonName}
          isInvalid={!value.personId}
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
      </div>
    </>
  );
}
