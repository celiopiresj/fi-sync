"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MovementForm } from "./movement-form";
import type {
  InvestmentMovementFormValues,
  InvestmentMovementKind,
} from "../../_schema/schema";
import type { TransferAccountOption } from "../../_types/types";

type MovementSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Which account this instance is scoped to — used only for the remount
  // key below; the actual mutation call happens in the caller's own
  // onSubmit (investments-view.tsx), which already knows the account.
  accountId: string;
  accountBalance: number;
  transferAccounts: TransferAccountOption[];
  // Which action opened the sheet — CONTRIBUTION for "Aportar", WITHDRAWAL
  // for "Resgatar". YIELD is only ever reached by switching the field
  // inside the form itself, not its own top-level button (see
  // investments-view.tsx's own comment on why).
  initialKind: InvestmentMovementKind;
  onSubmit: (
    values: InvestmentMovementFormValues,
  ) => Promise<{ error: string | null }>;
};

export function MovementSheet({
  open,
  onOpenChange,
  accountId,
  accountBalance,
  transferAccounts,
  initialKind,
  onSubmit,
}: MovementSheetProps) {
  const t = useTranslations("scrn-investments");

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
          <SheetTitle>{t(`movement.dialog.${initialKind.toLowerCase()}.title`)}</SheetTitle>
          <SheetDescription>
            {t(`movement.dialog.${initialKind.toLowerCase()}.description`)}
          </SheetDescription>
        </SheetHeader>

        {/* Remount on account/kind change so TanStack Form picks up a
            fresh `kind`/`date` default instead of keeping the previous
            sheet's state. */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <MovementForm
            key={`${accountId}-${initialKind}`}
            initialKind={initialKind}
            accountBalance={accountBalance}
            transferAccounts={transferAccounts}
            onSubmit={onSubmit}
            onSuccess={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
