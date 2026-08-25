"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PersonForm } from "./person-form";
import type { PersonFormValues } from "../../_schema/schema";
import type { PersonRow } from "../../_types/types";

type PersonSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  prefill: PersonRow | null;
  onSubmit: (values: PersonFormValues) => Promise<{ error: string | null }>;
};

export function PersonSheet({
  open,
  onOpenChange,
  mode,
  prefill,
  onSubmit,
}: PersonSheetProps) {
  const t = useTranslations("scrn-people");

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
          <PersonForm
            key={prefill?.id ?? "create"}
            isEditing={mode === "edit"}
            initialValues={prefill}
            onSubmit={onSubmit}
            onSuccess={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
