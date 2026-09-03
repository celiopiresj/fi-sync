"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CaretRightIcon, PiggyBankIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { WalletOverview } from "../_types/types";

type WalletInvestmentsRowProps = {
  overview: WalletOverview;
};

export function WalletInvestmentsRow({ overview }: WalletInvestmentsRowProps) {
  const t = useTranslations("scrn-wallet");
  const format = useFormatter();
  const isPositive = overview.investmentMovementThisMonth >= 0;

  return (
    <Link
      href="/investments"
      className="flex items-center gap-3 rounded-lg border border-border p-4"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-positive/10 text-positive">
        <PiggyBankIcon className="size-4.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{t("cards.investments.title")}</span>
        <span
          className={cn(
            "truncate text-xs",
            isPositive ? "text-positive" : "text-negative",
          )}
        >
          {t(isPositive ? "cards.investments.subtitlePositive" : "cards.investments.subtitleNegative", {
            value: format.number(Math.abs(overview.investmentMovementThisMonth), {
              style: "currency",
              currency: "BRL",
            }),
          })}
        </span>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {format.number(overview.totalInvested, { style: "currency", currency: "BRL" })}
      </span>
      <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
