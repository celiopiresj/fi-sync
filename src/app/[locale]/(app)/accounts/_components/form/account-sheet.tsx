"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AccountForm } from "./account-form";
import type { AccountFormValues, AccountTypeOption } from "../../_schema/schema";
import type { AccountRow } from "../../_types/types";

type AccountSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  prefill: AccountRow | null;
  // Which type to preselect when creating from a specific section's "add"
  // tile — see AccountForm's own defaultType prop.
  defaultType?: AccountTypeOption;
  onSubmit: (values: AccountFormValues) => Promise<{ error: string | null }>;
};

export function AccountSheet({
  open,
  onOpenChange,
  mode,
  prefill,
  defaultType,
  onSubmit,
}: AccountSheetProps) {
  const t = useTranslations("scrn-accounts");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Right side on desktop, full screen below `sm` — see
          components/ui/sheet.tsx. */}
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
            defaultValues instead of keeping the previous row's state. */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <AccountForm
            key={prefill?.id ?? "create"}
            isEditing={mode === "edit"}
            initialValues={prefill}
            defaultType={defaultType}
            onSubmit={onSubmit}
            onSuccess={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
