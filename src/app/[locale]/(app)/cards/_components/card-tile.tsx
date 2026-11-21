"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { resolveTileHeaderClass } from "@/lib/card-color";
import { cn } from "@/lib/utils";
import {
    DotsThreeIcon,
    PencilSimpleIcon,
    ReceiptIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useCardMoney } from "../_hooks/use-card-money";
import { getUsageTier } from "../_lib/card-usage";
import type { CreditCardAccountRow } from "../_types/types";
import { CardUsageBar } from "./card-usage-bar";

type CardTileProps = {
  account: CreditCardAccountRow;
  onEdit: () => void;
  onToggleStatus: (account: CreditCardAccountRow) => void;
  onDelete: (account: CreditCardAccountRow) => void;
};

// The "digital wallet" tile for "Todos os cartões" — a colored header
// (the first physical card's own chosen color, resolved to its bold
// form via _lib/card-tile-color.ts) with the account name + last 4
// digits, then usage/spend/cycle details below. "Ajustar limite" is
// this tile's edit entry point (same onEdit handler as every other
// action here) — no separate bare "Editar" button, since a full-width
// labeled button already covers that affordance in a tile this size
// (unlike the old dense row, which needed an icon-only pencil to stay
// compact).
export function CardTile({ account, onEdit, onToggleStatus, onDelete }: CardTileProps) {
  const t = useTranslations("scrn-cards");
  const money = useCardMoney();
  const tier = getUsageTier(account.usagePercent);
  const isActive = account.status === "ACTIVE";
  const [firstCard, ...restCards] = account.cards;
  const digits = firstCard?.lastFourDigits ?? "----";
  const headerClass = isActive
    ? resolveTileHeaderClass(firstCard?.colorStyle ?? null)
    : "bg-muted text-muted-foreground";

  return (
    <Card className="@container gap-0 py-0">
      <div className={cn("flex flex-col gap-4 p-4", headerClass)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="break-words text-sm font-bold uppercase tracking-wide">
              {account.name}
            </span>
            {!isActive && (
              <Badge variant="secondary" className="shrink-0">
                {t("status.disabled")}
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-11 shrink-0 text-current hover:bg-white/20 hover:text-current md:size-8"
              >
                <DotsThreeIcon aria-hidden="true" />
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
        <span className="text-sm font-medium tabular-nums opacity-90">
          •••• {digits}
          {restCards.length > 0 ? ` +${restCards.length}` : ""}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">
              {t("sections.all.usageLabel")}
            </span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                tier !== "ok" && (tier === "warning" ? "text-warning" : "text-negative"),
              )}
            >
              {account.usagePercent}%
            </span>
          </div>
          <CardUsageBar
            usagePercent={account.usagePercent}
            tier={tier}
            label={account.name}
          />
        </div>

        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">{t("sections.all.spentLabel")}</span>
            <span className="font-semibold tabular-nums">{money(account.spent)}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-muted-foreground">{t("sections.all.availableLabel")}</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                account.availableLimit < 0 && "text-negative",
              )}
            >
              {money(account.availableLimit)}
            </span>
          </div>
        </div>

        <p className="text-xs tabular-nums text-muted-foreground">
          {t("cards.cycleSummary", {
            closingDay: account.closingDay ?? 0,
            dueDay: account.dueDay ?? 0,
          })}
        </p>

        <div className="mt-auto flex flex-col gap-2 pt-1 @xs:flex-row">
          <Button
            variant="outline"
            size="sm"
            className="h-11 flex-1 sm:h-8"
            onClick={onEdit}
          >
            <PencilSimpleIcon aria-hidden="true" />
            {t("buttons.adjustLimit")}
          </Button>
          <Button asChild variant="outline" size="sm" className="h-11 flex-1 sm:h-8">
            <Link href="/invoices">
              <ReceiptIcon aria-hidden="true" />
              {t("buttons.viewInvoice")}
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
