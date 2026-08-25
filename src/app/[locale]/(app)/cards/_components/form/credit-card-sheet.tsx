"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CreditCardForm } from "./credit-card-form";
import type { CreditCardAccountFormValues } from "../../_schema/schema";
import type { CreditCardAccountRow } from "../../_types/types";

type CreditCardSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  prefill: CreditCardAccountRow | null;
  onSubmit: (
    values: CreditCardAccountFormValues,
  ) => Promise<{ error: string | null }>;
  onCardStatusChanged: () => void;
};

export function CreditCardSheet({
  open,
  onOpenChange,
  mode,
  prefill,
  onSubmit,
  onCardStatusChanged,
}: CreditCardSheetProps) {
  const t = useTranslations("scrn-cards");

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

        {/* Remount on prefill change so TanStack Form picks up fresh
            defaultValues instead of keeping the previous row's state —
            same as account-sheet.tsx. */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <CreditCardForm
            key={prefill?.id ?? "create"}
            isEditing={mode === "edit"}
            initialValues={prefill}
            onSubmit={onSubmit}
            onSuccess={() => onOpenChange(false)}
            onCardStatusChanged={onCardStatusChanged}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
