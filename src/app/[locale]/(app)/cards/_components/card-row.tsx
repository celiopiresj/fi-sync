"use client";

import { useFormatter, useTranslations } from "next-intl";
import { DotsThreeIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getUsageTier } from "../_lib/card-usage";
import type { CreditCardAccountRow } from "../_types/types";
import { CardChip } from "./card-chip";
import { CardUsageBar } from "./card-usage-bar";

type CardRowProps = {
  account: CreditCardAccountRow;
  onEdit: () => void;
  onToggleStatus: (account: CreditCardAccountRow) => void;
  onDelete: (account: CreditCardAccountRow) => void;
};

// The "seção 5" dense-row layout — uso% · disp. R$ disponível · fecha ·
// vence, icon-only edit button at the row's end (spec section 7). The
// archive/reactivate/delete actions that used to live in this row's own
// dropdown menu are kept, just moved into a second icon button so the
// edit affordance itself stays a dedicated, always-visible pencil icon.
export function CardRow({ account, onEdit, onToggleStatus, onDelete }: CardRowProps) {
  const t = useTranslations("scrn-cards");
  const format = useFormatter();
  const tier = getUsageTier(account.usagePercent);
  const isActive = account.status === "ACTIVE";

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <CardChip cards={account.cards} status={account.status} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium">{account.name}</span>
          {!isActive && <Badge variant="secondary">{t("status.disabled")}</Badge>}
        </div>
        <p
          className={cn(
            "text-xs tabular-nums",
            tier === "warning" ? "text-warning" : "text-muted-foreground",
          )}
        >
          {t("sections.all.meta", {
            usagePercent: account.usagePercent,
            available: money(account.availableLimit),
            closingDay: account.closingDay ?? 0,
            dueDay: account.dueDay ?? 0,
          })}
        </p>
        <CardUsageBar usagePercent={account.usagePercent} tier={tier} />
      </div>

      <Button variant="ghost" size="icon-sm" onClick={onEdit}>
        <PencilSimpleIcon />
        <span className="sr-only">{t("buttons.edit")}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <DotsThreeIcon />
            <span className="sr-only">{t("aria.menu")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onToggleStatus(account)}>
            {t(isActive ? "menu.archive" : "menu.reactivate")}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(account)}>
            {t("menu.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
