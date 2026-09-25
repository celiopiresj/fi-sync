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
  TransferFormValues,
  TransferTarget,
} from "../../_schema/schema";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
} from "../../_types/types";
import { TransferForm } from "./transfer-form";

type TransferSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  defaultAccountId: string | null;
  initialTarget?: TransferTarget;
  onSubmit: (values: TransferFormValues) => Promise<{ error: string | null }>;
};

// /transactions' desktop entry point for a transferência — the same
// right-side sheet shell DebitTransactionSheet uses, same `max-w-xl`
// (with the primitive's own `data-[side=right]:` prefix, AGENTS.md).
// Sheet content unmounts on close, so every opening starts from a
// fresh form without a key.
export function TransferSheet({
  open,
  onOpenChange,
  accounts,
  categories,
  people,
  defaultAccountId,
  initialTarget,
  onSubmit,
}: TransferSheetProps) {
  const t = useTranslations("scrn-transactions");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={t("aria.close")}
        className="flex flex-col data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="p-4">
          <SheetTitle>{t("transfer.title")}</SheetTitle>
          <SheetDescription>{t("transfer.description")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <TransferForm
            accounts={accounts}
            categories={categories}
            people={people}
            defaultAccountId={defaultAccountId}
            initialTarget={initialTarget}
            onSubmit={onSubmit}
            onSuccess={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
