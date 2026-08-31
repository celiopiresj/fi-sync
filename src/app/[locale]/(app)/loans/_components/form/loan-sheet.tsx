"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LoanForm } from "./loan-form";
import type { LoanFormValues } from "../../_schema/schema";
import type {
  LoanAccountOption,
  LoanFormPrefill,
  LoanPersonOption,
} from "../../_types/types";

type LoanSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  prefill: LoanFormPrefill | null;
  people: LoanPersonOption[];
  accounts: LoanAccountOption[];
  onSubmit: (
    values: LoanFormValues,
    options?: { skipPastInstallments?: boolean },
  ) => Promise<{ error: string | null }>;
};

export function LoanSheet({
  open,
  onOpenChange,
  mode,
  prefill,
  people,
  accounts,
  onSubmit,
}: LoanSheetProps) {
  const t = useTranslations("scrn-loans");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={t("aria.close")}
        className="flex flex-col data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="p-4">
          <SheetTitle>{t(`dialog.${mode}.title`)}</SheetTitle>
          <SheetDescription>{t(`dialog.${mode}.description`)}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <LoanForm
            key={prefill?.id ?? "create"}
            isEditing={mode === "edit"}
            initialValues={prefill}
            people={people}
            accounts={accounts}
            onSubmit={onSubmit}
            onSuccess={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
