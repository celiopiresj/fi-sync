"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  BatchRowFormValues,
  CreditBatchRowFormValues,
} from "../../_schema/schema";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
} from "../../_types/types";
import { ImportStatementScreen } from "./import-statement-screen";

type ImportStatementSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  defaultPersonId: string | null;
  onSubmitDebit: (
    rows: BatchRowFormValues[],
  ) => Promise<{ error: string | null; rowIndex: number | null }>;
  onSubmitCredit: (
    rows: CreditBatchRowFormValues[],
  ) => Promise<{ error: string | null; rowIndex: number | null }>;
  onSuccess: (count: number) => void;
};

// /transactions' desktop entry point for the import, alongside
// DebitTransactionSheet/CreditTransactionSheet — the same right-side
// sheet shell they use, wrapping the exact same screen the FAB's drawer
// shows on a phone. The screen itself is told to skip its own title and
// close control (the SheetHeader and SheetContent already have both).
//
// `sm:max-w-2xl` matches the batch table's own widened sheet: the review
// list is a row per statement line, and the default `sm:max-w-sm` turns
// every one of them into three wrapped lines. The override repeats the
// primitive's `data-[side=right]:` prefix — without it SheetContent's own
// `data-[side=right]:sm:max-w-sm` wins on specificity (AGENTS.md).
export function ImportStatementSheet({
  open,
  onOpenChange,
  accounts,
  categories,
  people,
  defaultPersonId,
  onSubmitDebit,
  onSubmitCredit,
  onSuccess,
}: ImportStatementSheetProps) {
  const t = useTranslations("scrn-transactions");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={t("aria.close")}
        className="flex flex-col gap-0 data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="p-4">
          <SheetTitle>{t("import.title")}</SheetTitle>
          <SheetDescription>{t("import.description")}</SheetDescription>
        </SheetHeader>

        {/* No key/guard needed to reset it between openings: Sheet
            portals its content without forceMount, so closing unmounts
            the screen and the next import starts back at the destination
            step with no file attached. */}
        <ImportStatementScreen
          accounts={accounts}
          categories={categories}
          people={people}
          defaultPersonId={defaultPersonId}
          onSubmitDebit={onSubmitDebit}
          onSubmitCredit={onSubmitCredit}
          onSuccess={onSuccess}
          showTitle={false}
        />
      </SheetContent>
    </Sheet>
  );
}
