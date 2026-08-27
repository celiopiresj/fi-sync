"use client";

import { useFormatter, useTranslations } from "next-intl";
import { DotsThreeIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getUsageTier } from "../_lib/card-usage";
import type { CreditCardAccountRow } from "../_types/types";
import { CardChip } from "./card-chip";
import { CardUsageBar } from "./card-usage-bar";

type CardTableProps = {
  accounts: CreditCardAccountRow[];
  onEdit: (id: string) => void;
  onToggleStatus: (account: CreditCardAccountRow) => void;
  onDelete: (account: CreditCardAccountRow) => void;
};

// The list-mode alternative to CardTile's grid — same data, same
// actions, just a denser row-per-card layout for scanning many cards at
// once.
export function CardTable({ accounts, onEdit, onToggleStatus, onDelete }: CardTableProps) {
  const t = useTranslations("scrn-cards");
  const format = useFormatter();

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.columns.card")}</TableHead>
            <TableHead>{t("table.columns.usage")}</TableHead>
            <TableHead className="text-right">{t("table.columns.spent")}</TableHead>
            <TableHead className="text-right">{t("table.columns.available")}</TableHead>
            <TableHead>{t("table.columns.cycle")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => {
            const tier = getUsageTier(account.usagePercent);
            const isActive = account.status === "ACTIVE";
            return (
              <TableRow key={account.id}>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-2">
                    <CardChip cards={account.cards} status={account.status} />
                    <span className="min-w-0 truncate font-medium">{account.name}</span>
                    {!isActive && <Badge variant="secondary">{t("status.disabled")}</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex w-32 flex-col gap-1">
                    <span
                      className={cn(
                        "text-xs font-medium tabular-nums",
                        tier !== "ok" && (tier === "warning" ? "text-warning" : "text-negative"),
                      )}
                    >
                      {account.usagePercent}%
                    </span>
                    <CardUsageBar usagePercent={account.usagePercent} tier={tier} />
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(account.spent)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    account.availableLimit < 0 && "text-negative",
                  )}
                >
                  {money(account.availableLimit)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t("cards.cycleSummary", {
                    closingDay: account.closingDay ?? 0,
                    dueDay: account.dueDay ?? 0,
                  })}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => onEdit(account.id)}>
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
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => onDelete(account)}
                        >
                          {t("menu.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
