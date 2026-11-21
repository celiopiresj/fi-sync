"use client";

import { useTranslations } from "next-intl";
import { BankIcon, StarIcon } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getAccountColorClasses } from "../_lib/account-color";
import { useAccountMoney } from "../_hooks/use-account-money";
import { AccountActionsMenu } from "./account-actions-menu";
import type { AccountRow } from "../_types/types";

type AccountCardProps = {
  account: AccountRow;
  onEdit: (account: AccountRow) => void;
  onToggleDefault: (account: AccountRow) => void;
  onToggleStatus: (account: AccountRow) => void;
  onDelete: (account: AccountRow) => void;
};

// Same anatomy as the home's "Minhas contas" tile (colored icon + name on
// top, balance large, details underneath), plus the actions menu. The
// name link stretches over the whole tile (`after:absolute after:inset-0`
// anchored by the Card's `relative`), so tapping anywhere opens the
// detail screen; the focus ring is drawn on the tile itself. An archived
// account gets a muted surface, icon and an "Inativa" badge instead of a
// translucent card, which used to drop its text below readable contrast.
export function AccountCard({
  account,
  onEdit,
  onToggleDefault,
  onToggleStatus,
  onDelete,
}: AccountCardProps) {
  const t = useTranslations("scrn-accounts");
  const tCommon = useTranslations("common");
  const money = useAccountMoney();
  const color = getAccountColorClasses(account.id);
  const isInactive = account.status === "INACTIVE";

  return (
    <Card
      size="sm"
      className={cn(
        "@container relative transition-colors hover:border-primary/50 has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring/30",
        isInactive && "bg-muted/40",
      )}
    >
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-lg",
                isInactive ? "bg-muted" : color.bg,
              )}
            >
              <BankIcon
                weight="fill"
                className={cn(
                  "size-4",
                  isInactive ? "text-muted-foreground" : color.icon,
                )}
              />
            </span>
            <Link
              href={`/accounts/${account.id}`}
              className="min-w-0 break-words text-sm font-semibold text-foreground outline-none after:absolute after:inset-0 after:rounded-2xl"
            >
              {account.name}
            </Link>
          </span>
          <AccountActionsMenu
            account={account}
            onEdit={onEdit}
            onToggleDefault={onToggleDefault}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
          />
        </div>

        <div className="flex flex-col gap-0.5">
          <span
            className={cn(
              "font-heading text-lg font-bold tracking-tight whitespace-nowrap tabular-nums @[14rem]:text-xl",
              account.balance < 0 ? "text-negative" : "text-foreground",
            )}
          >
            <span className="sr-only">{t("fields.balance.label")} </span>
            {money(account.balance)}
          </span>
          {account.initialBalance !== null && (
            <span className="break-words text-xs text-muted-foreground">
              {t.rich("cards.initialBalance", {
                value: money(account.initialBalance),
                amount: (chunks) => (
                  <span className="whitespace-nowrap tabular-nums">
                    {chunks}
                  </span>
                ),
              })}
            </span>
          )}
        </div>

        {(account.isDefault || isInactive) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {account.isDefault && (
              <Badge variant="outline">
                <StarIcon weight="fill" />
                {t("card.defaultBadge")}
              </Badge>
            )}
            {isInactive && (
              <Badge variant="secondary">
                {tCommon("status.inactive")}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
