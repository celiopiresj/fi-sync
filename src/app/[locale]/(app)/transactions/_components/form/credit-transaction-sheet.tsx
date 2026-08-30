"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CreditTransactionForm } from "./credit-transaction-form";
import { CreditBatchTransactionTable } from "./credit-batch-transaction-table";
import type {
  CreditBatchRowFormValues,
  CreditTransactionFormValues,
} from "../../_schema/schema";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
  TransactionRow,
} from "../../_types/types";

type EntryMode = "single" | "batch";

type CreditTransactionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  prefill: TransactionRow | null;
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  defaultPersonId: string | null;
  onSubmit: (
    values: CreditTransactionFormValues,
    options?: {
      skipPastInstallments?: boolean;
      editScope?: "this" | "all" | "future";
    },
  ) => Promise<{ error: string | null }>;
  onSubmitBatch: (
    rows: CreditBatchRowFormValues[],
  ) => Promise<{ error: string | null; rowIndex: number | null }>;
  onBatchSuccess: (count: number) => void;
};

export function CreditTransactionSheet({
  open,
  onOpenChange,
  mode,
  prefill,
  accounts,
  categories,
  people,
  defaultPersonId,
  onSubmit,
  onSubmitBatch,
  onBatchSuccess,
}: CreditTransactionSheetProps) {
  const t = useTranslations("scrn-transactions");
  const [entryMode, setEntryMode] = useState<EntryMode>("single");

  // Only creating a brand-new purchase can go through the batch table —
  // editing/duplicating a single row always uses the regular form. Same
  // convention as DebitTransactionSheet's own canUseBatch/isBatch.
  const canUseBatch = mode === "create" && !prefill;
  const isBatch = canUseBatch && entryMode === "batch";

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setEntryMode("single");
        onOpenChange(nextOpen);
      }}
    >
      <SheetContent
        side="right"
        closeLabel={t("aria.close")}
        className={`flex flex-col ${isBatch ? "data-[side=right]:sm:max-w-2xl" : "data-[side=right]:sm:max-w-xl"}`}
      >
        <SheetHeader className="p-4">
          <SheetTitle>{t(`dialog.${mode === "edit" ? "editCredit" : "createCredit"}.title`)}</SheetTitle>
          <SheetDescription>
            {t(`dialog.${mode === "edit" ? "editCredit" : "createCredit"}.description`)}
          </SheetDescription>
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
              }}
            >
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
            <CreditBatchTransactionTable
              accounts={accounts}
              categories={categories}
              people={people}
              defaultPersonId={defaultPersonId}
              onSubmit={onSubmitBatch}
              onSuccess={(count) => {
                onBatchSuccess(count);
                onOpenChange(false);
              }}
            />
          ) : (
            <CreditTransactionForm
              key={prefill?.id ?? "create"}
              isEditing={mode === "edit"}
              initialValues={prefill}
              accounts={accounts}
              categories={categories}
              people={people}
              defaultPersonId={defaultPersonId}
              onSubmit={onSubmit}
              onSuccess={() => onOpenChange(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
