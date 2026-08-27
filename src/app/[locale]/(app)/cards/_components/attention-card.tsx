"use client";

import { useFormatter, useTranslations } from "next-intl";
import { DotsThreeIcon } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CreditCardAccountRow } from "../_types/types";
import { CardChip } from "./card-chip";
import { CardUsageBar } from "./card-usage-bar";

type AttentionCardProps = {
  account: CreditCardAccountRow;
  onEdit: () => void;
  onToggleStatus: (account: CreditCardAccountRow) => void;
  onDelete: (account: CreditCardAccountRow) => void;
};

// The "seção 3" large-card layout — every card here is already >= 95%
// usage, but splits into two tones depending on exactly how bad: over
// 100% (rose — spent has actually exceeded the limit, "Excedido em
// +R$X") vs 95-100% (amber — right at/near the ceiling but not over
// yet, "R$X disponível"). Same split drives the badge wording, the bar
// color (CardUsageBar's own warning/critical tiers), and the invoice
// button ("Pagar Fatura" vs "Ver Fatura"). "Ajustar limite" is this
// card's edit entry point for an active account (same onEdit handler as
// everywhere else); a disabled account can't adjust its own limit, so
// it gets a plain "Editar" instead — either way an edit affordance is
// always present, per the original spec's "sem exceção" rule.
export function AttentionCard({
  account,
  onEdit,
  onToggleStatus,
  onDelete,
}: AttentionCardProps) {
  const t = useTranslations("scrn-cards");
  const format = useFormatter();
  const isActive = account.status === "ACTIVE";
  const isOverLimit = account.usagePercent > 100;

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  return (
    <div
      className={cn(
        "flex w-full max-w-85 flex-col gap-3 rounded-lg border p-4",
        isOverLimit ? "border-negative/40 bg-negative/5" : "border-warning/40 bg-warning/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CardChip cards={account.cards} status={account.status} />
          <span className="min-w-0 truncate text-sm font-medium">{account.name}</span>
          {!isActive && <Badge variant="secondary">{t("status.disabled")}</Badge>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge
            variant="outline"
            className={cn(
              isOverLimit
                ? "border-negative/30 bg-negative/10 text-negative"
                : "border-warning/30 bg-warning/10 text-warning",
            )}
          >
            {t(isOverLimit ? "sections.attention.overBadge" : "sections.attention.nearBadge", {
              percentage: account.usagePercent,
            })}
          </Badge>
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
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span
          className={cn(
            "font-medium tabular-nums",
            isOverLimit ? "text-negative" : "text-warning",
          )}
        >
          {t("sections.attention.spentLabel", { value: money(account.spent) })}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {t("sections.attention.limitLabel", { value: money(account.limit) })}
        </span>
      </div>

      <CardUsageBar
        usagePercent={account.usagePercent}
        tier={isOverLimit ? "critical" : "warning"}
      />

      <p
        className={cn(
          "text-xs font-medium",
          isOverLimit ? "text-negative" : "text-warning",
        )}
      >
        {isOverLimit
          ? t("sections.attention.exceededMessage", {
              amount: money(account.spent - account.limit),
            })
          : t("sections.attention.nearLimitMessage", {
              available: money(account.availableLimit),
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
        <Button variant="outline" size="sm" onClick={onEdit}>
          {t(isActive ? "buttons.adjustLimit" : "buttons.edit")}
        </Button>
        <Button
          asChild
          size="sm"
          className={cn(
            "text-white",
            isOverLimit ? "bg-negative hover:bg-negative/90" : "bg-warning hover:bg-warning/90",
          )}
        >
          <Link href="/invoices">
            {t(isOverLimit ? "buttons.payInvoice" : "buttons.viewInvoice")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
