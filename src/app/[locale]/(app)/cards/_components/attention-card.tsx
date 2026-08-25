"use client";

import { useFormatter, useTranslations } from "next-intl";
import { DotsThreeIcon, PencilSimpleIcon, ReceiptIcon } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CreditCardAccountRow } from "../_types/types";
import { CardChip } from "./card-chip";
import { CardUsageBar } from "./card-usage-bar";

type AttentionCardProps = {
  account: CreditCardAccountRow;
  onEdit: () => void;
  onToggleStatus: (account: CreditCardAccountRow) => void;
  onDelete: (account: CreditCardAccountRow) => void;
};

// The "seção 3" large-card layout from the cards-screen spec — uso% de
// R$ limite · fecha dia · vence dia, red border/text throughout since
// every card rendered here is already >= 95% usage. "Ajustar limite"
// only shows for an active account (a disabled one can't raise its own
// limit); "Editar" is always present, per the spec's "sem exceção" rule.
export function AttentionCard({
  account,
  onEdit,
  onToggleStatus,
  onDelete,
}: AttentionCardProps) {
  const t = useTranslations("scrn-cards");
  const format = useFormatter();
  const isActive = account.status === "ACTIVE";

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  return (
    <div className="flex w-full max-w-85 flex-col gap-3 rounded-lg border border-negative/40 bg-negative/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CardChip cards={account.cards} status={account.status} />
          <span className="min-w-0 truncate text-sm font-medium">{account.name}</span>
          {!isActive && <Badge variant="secondary">{t("status.disabled")}</Badge>}
        </div>
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

      <CardUsageBar usagePercent={account.usagePercent} tier="critical" />

      <p className="text-sm font-medium tabular-nums text-negative">
        {t("sections.attention.usageLine", {
          usagePercent: account.usagePercent,
          limit: money(account.limit),
        })}
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {t("cards.cycleSummary", {
          closingDay: account.closingDay ?? 0,
          dueDay: account.dueDay ?? 0,
        })}
      </p>

      {!isActive && (
        <p className="text-xs text-muted-foreground">{t("status.disabledNote")}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/invoices">
            <ReceiptIcon />
            {t("buttons.viewInvoice")}
          </Link>
        </Button>
        {isActive && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            {t("buttons.adjustLimit")}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onEdit}>
          <PencilSimpleIcon />
          {t("buttons.edit")}
        </Button>
      </div>
    </div>
  );
}
