"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CreditRecurrenceCreateForm, CreditRecurrenceEditForm } from "./credit-recurrence-form";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
  RecurrenceRow,
} from "../../_types/types";
import type {
  CreditRecurrenceContentFormValues,
  CreditRecurrenceCreateFormValues,
} from "../../_schema/schema";

type CreditRecurrenceSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  editingRow: RecurrenceRow | null;
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  defaultPersonId: string | null;
  defaultAccountId: string | null;
  onSubmitCreate: (
    values: CreditRecurrenceCreateFormValues,
  ) => Promise<{ error: string | null }>;
  onSubmitEdit: (
    values: CreditRecurrenceContentFormValues,
  ) => Promise<{ error: string | null; updatedCount?: number }>;
};

export function CreditRecurrenceSheet({
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
}: CreditRecurrenceSheetProps) {
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
          <SheetTitle>
            {t(`dialog.${isEditing ? "editCredit" : "createCredit"}.title`)}
          </SheetTitle>
          <SheetDescription>
            {t(`dialog.${isEditing ? "editCredit" : "createCredit"}.description`)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isEditing ? (
            <CreditRecurrenceEditForm
              key={editingRow.id}
              initialValues={editingRow}
              accounts={accounts}
              categories={categories}
              people={people}
              onSubmit={onSubmitEdit}
              onSuccess={() => onOpenChange(false)}
            />
          ) : (
            <CreditRecurrenceCreateForm
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
