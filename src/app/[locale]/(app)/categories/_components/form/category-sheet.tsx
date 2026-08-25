"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CategoryForm } from "./category-form";
import type { CategoryFormValues } from "../../_schema/schema";
import type { CategoryRow } from "../../_types/types";

type CategorySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  prefill: CategoryRow | null;
  onSubmit: (values: CategoryFormValues) => Promise<{ error: string | null }>;
};

export function CategorySheet({
  open,
  onOpenChange,
  mode,
  prefill,
  onSubmit,
}: CategorySheetProps) {
  const t = useTranslations("scrn-categories");
  const tCommon = useTranslations("common");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={tCommon("buttons.cancel")}
        className="flex flex-col data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="p-4">
          <SheetTitle>{t(`dialog.${mode}.title`)}</SheetTitle>
          <SheetDescription>{t(`dialog.${mode}.description`)}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <CategoryForm
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
