"use client";

import { useTranslations } from "next-intl";
import { BankIcon } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { getAccountColorClasses } from "../../accounts/_lib/account-color";
import type { HomeOverview } from "../_types/types";

type AccountTileProps = {
  account: HomeOverview["accounts"][number];
  money: (value: number) => string;
};

// One account in the home "Minhas contas" grid: icon + name on top, the
// balance in large type, the account type underneath. The balance steps
// down a size in a narrow tile (container query) instead of truncating.
export function AccountTile({ account, money }: AccountTileProps) {
  const t = useTranslations("scrn-home.accounts");
  const color = getAccountColorClasses(account.id);

  return (
    <Link
      href={`/accounts/${account.id}`}
      className="@container flex min-w-0 flex-col justify-between gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-colors hover:border-primary/50"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg",
            color.bg,
          )}
        >
          <BankIcon weight="fill" className={cn("size-4", color.icon)} />
        </span>
        <span className="min-w-0 break-words text-sm font-semibold text-foreground">
          {account.name}
        </span>
      </span>
      <span className="flex flex-col gap-0.5">
        <span
          className={cn(
            "font-heading text-base font-bold tracking-tight whitespace-nowrap tabular-nums @[10rem]:text-lg",
            account.balance < 0 ? "text-negative" : "text-foreground",
          )}
        >
          {money(account.balance)}
        </span>
        <span className="break-words text-xs text-muted-foreground">
          {t(`type.${account.type.toLowerCase()}`)}
        </span>
      </span>
    </Link>
  );
}
