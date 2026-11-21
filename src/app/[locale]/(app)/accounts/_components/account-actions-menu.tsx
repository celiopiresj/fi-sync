"use client";

import { useTranslations } from "next-intl";
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  DotsThreeIcon,
  PencilSimpleIcon,
  StarIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AccountRow } from "../_types/types";

type AccountActionsMenuProps = {
  account: AccountRow;
  onEdit: (account: AccountRow) => void;
  onToggleDefault: (account: AccountRow) => void;
  onToggleStatus: (account: AccountRow) => void;
  onDelete: (account: AccountRow) => void;
};

// The secondary actions of an account tile, one tap away. `relative z-10`
// lifts the trigger above the tile's stretched link; the trigger and the
// items are 44px tall on touch screens and shrink back from `md` up.
export function AccountActionsMenu({
  account,
  onEdit,
  onToggleDefault,
  onToggleStatus,
  onDelete,
}: AccountActionsMenuProps) {
  const t = useTranslations("scrn-accounts");
  const isActive = account.status === "ACTIVE";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("aria.menuFor", { name: account.name })}
          className="relative z-10 -my-2 -mr-2 size-11 text-muted-foreground md:my-0 md:mr-0 md:size-8"
        >
          <DotsThreeIcon weight="bold" className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="min-h-11 md:min-h-7"
          onSelect={() => onEdit(account)}
        >
          <PencilSimpleIcon />
          {t("menu.edit")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-11 md:min-h-7"
          onSelect={() => onToggleDefault(account)}
        >
          <StarIcon />
          {t(account.isDefault ? "menu.unsetDefault" : "menu.setDefault")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-11 md:min-h-7"
          onSelect={() => onToggleStatus(account)}
        >
          {isActive ? <ArchiveIcon /> : <ArrowCounterClockwiseIcon />}
          {t(isActive ? "menu.archive" : "menu.reactivate")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="min-h-11 md:min-h-7"
          onSelect={() => onDelete(account)}
        >
          <TrashIcon />
          {t("menu.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
