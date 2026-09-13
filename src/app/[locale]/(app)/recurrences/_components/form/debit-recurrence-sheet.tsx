"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DebitRecurrenceCreateForm, DebitRecurrenceEditForm } from "./debit-recurrence-form";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
  RecurrenceRow,
} from "../../_types/types";
import type {
  DebitRecurrenceContentFormValues,
  DebitRecurrenceCreateFormValues,
} from "../../_schema/schema";

type DebitRecurrenceSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  // The row being edited — null for "create" (mirrors
  // DebitTransactionSheet's `prefill`, simplified: this screen has no
  // "duplicate" entry point, so there's no separate prefill-vs-editing
  // distinction to carry).
  editingRow: RecurrenceRow | null;
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  defaultPersonId: string | null;
  defaultAccountId: string | null;
  onSubmitCreate: (
    values: DebitRecurrenceCreateFormValues,
  ) => Promise<{ error: string | null }>;
  onSubmitEdit: (
    values: DebitRecurrenceContentFormValues,
  ) => Promise<{ error: string | null; updatedCount?: number }>;
};

// Presentational Sheet wrapper mirroring debit-transaction-sheet.tsx:
// this component owns none of the Server Action calls itself
// (onSubmitCreate/onSubmitEdit come from recurrences-view.tsx, which
// also owns invalidate()/toast) — it only decides create-vs-edit and
// closes itself on success. No single/batch mode toggle here (that's
// transactions-only) — this sheet only ever shows one form.
export function DebitRecurrenceSheet({
  open,
  onOpenChange,
  mode,
  editingRow,
  accounts,
  categories,
  people,
  defaultPersonId,
  defaultAccountId,
  onSubmitCreate,
  onSubmitEdit,
}: DebitRecurrenceSheetProps) {
  const t = useTranslations("scrn-recurrences");
  const isEditing = mode === "edit" && editingRow !== null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={t("aria.close")}
        className="flex flex-col data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="p-4">
          <SheetTitle>{t(`dialog.${isEditing ? "edit" : "create"}.title`)}</SheetTitle>
          <SheetDescription>
            {t(`dialog.${isEditing ? "edit" : "create"}.description`)}
          </SheetDescription>
        </SheetHeader>

        {/* Remount when the row being edited changes (or when switching
            back to create) so TanStack Form picks up fresh defaultValues
            instead of keeping the previous row's state. */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isEditing ? (
            <DebitRecurrenceEditForm
              key={editingRow.id}
              initialValues={editingRow}
              accounts={accounts}
              categories={categories}
              people={people}
              onSubmit={onSubmitEdit}
              onSuccess={() => onOpenChange(false)}
            />
          ) : (
            <DebitRecurrenceCreateForm
              key="create"
              accounts={accounts}
              categories={categories}
              people={people}
              defaultPersonId={defaultPersonId}
              defaultAccountId={defaultAccountId}
              onSubmit={onSubmitCreate}
              onSuccess={() => onOpenChange(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
