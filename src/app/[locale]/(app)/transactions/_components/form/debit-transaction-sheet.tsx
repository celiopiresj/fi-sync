"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type {
  BatchRowFormValues,
  DebitTransactionFormValues,
} from "../../_schema/schema";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
  TransactionRow,
} from "../../_types/types";
import { BatchTransactionTable } from "./batch-transaction-table";
import { DebitTransactionForm } from "./debit-transaction-form";

type EntryMode = "single" | "batch";

type DebitTransactionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  // Source of values to prefill the form with — the row being edited, or
  // (for "duplicate") the row being copied from. Distinct from `mode`:
  // duplicating pre-fills but still creates a new row.
  prefill: TransactionRow | null;
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  defaultPersonId: string | null;
  defaultAccountId: string | null;
  onSubmit: (
    values: DebitTransactionFormValues,
  ) => Promise<{ error: string | null }>;
  onSubmitBatch: (
    rows: BatchRowFormValues[],
  ) => Promise<{ error: string | null; rowIndex: number | null }>;
  onBatchSuccess: (count: number) => void;
};

export function DebitTransactionSheet({
  open,
  onOpenChange,
  mode,
  prefill,
  accounts,
  categories,
  people,
  defaultPersonId,
  defaultAccountId,
  onSubmit,
  onSubmitBatch,
  onBatchSuccess,
}: DebitTransactionSheetProps) {
  const t = useTranslations("scrn-transactions");
  const [entryMode, setEntryMode] = useState<EntryMode>("single");

  // Only creating a brand-new transaction can go through the batch
  // table — editing/duplicating a single row always uses the regular
  // form.
  const canUseBatch = mode === "create" && !prefill;
  const isBatch = canUseBatch && entryMode === "batch";

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setEntryMode("single");
        onOpenChange(nextOpen);
      }}>
      {/* Right side on desktop, full screen below `sm` — see
          components/ui/sheet.tsx (data-[side=right]:w-full, capped by
          the sm:max-w-* below). */}
      <SheetContent
        side="right"
        closeLabel={t("aria.close")}
        className={`flex flex-col ${isBatch ? "data-[side=right]:sm:max-w-2xl" : "data-[side=right]:sm:max-w-xl"}`}>
        <SheetHeader className="p-4">
          <SheetTitle>{t(`dialog.${mode}.title`)}</SheetTitle>
          <SheetDescription>{t(`dialog.${mode}.description`)}</SheetDescription>
        </SheetHeader>

        {canUseBatch && (
          <div className="px-4 pb-4">
            <ToggleGroup
              type="single"
              variant="tabs"
              className="w-full"
              value={entryMode}
              onValueChange={(value) => {
                if (value) setEntryMode(value as EntryMode);
              }}>
              <ToggleGroupItem value="single" className="flex-1">
                {t("mode.single")}
              </ToggleGroupItem>
              <ToggleGroupItem value="batch" className="flex-1">
                {t("mode.batch")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}

        {/* Remount when the prefill source or entry mode changes so
            TanStack Form picks up fresh defaultValues instead of keeping
            the previous row's/mode's state. */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isBatch ? (
            <BatchTransactionTable
              accounts={accounts}
              categories={categories}
              people={people}
              defaultPersonId={defaultPersonId}
              defaultAccountId={defaultAccountId}
              onSubmit={onSubmitBatch}
              onSuccess={(count) => {
                onBatchSuccess(count);
                onOpenChange(false);
              }}
            />
          ) : (
            <DebitTransactionForm
              key={prefill?.id ?? "create"}
              isEditing={mode === "edit"}
              initialValues={prefill}
              accounts={accounts}
              categories={categories}
              people={people}
              defaultPersonId={defaultPersonId}
              defaultAccountId={defaultAccountId}
              onSubmit={onSubmit}
              onSuccess={() => onOpenChange(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
