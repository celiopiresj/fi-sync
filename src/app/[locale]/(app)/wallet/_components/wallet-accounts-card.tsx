"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BankIcon, CaretRightIcon } from "@phosphor-icons/react";
import type { WalletOverview } from "../_types/types";

const PREVIEW_COUNT = 4;

type WalletAccountsCardProps = {
  overview: WalletOverview;
};

export function WalletAccountsCard({ overview }: WalletAccountsCardProps) {
  const t = useTranslations("scrn-wallet");
  const format = useFormatter();

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  return (
    <div className="flex flex-col rounded-lg border border-border">
      <Link
        href="/accounts"
        className="flex items-center justify-between gap-2 p-4"
      >
        <span className="text-sm font-medium">{t("cards.accounts.title")}</span>
        <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
          {money(overview.totalBalance)}
          <CaretRightIcon className="size-3.5 text-muted-foreground" />
        </span>
      </Link>

      <div className="flex flex-col divide-y divide-border border-t border-border">
        {overview.accounts.slice(0, PREVIEW_COUNT).map((account) => (
          <div key={account.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <BankIcon className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{account.name}</span>
            <span className="shrink-0 text-sm font-medium tabular-nums">
              {money(account.balance)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
