"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CaretRightIcon, CreditCardIcon, WalletIcon } from "@phosphor-icons/react";
import type { HomeOverview } from "../_types/types";

type HomeAccountsCarouselProps = {
  accounts: HomeOverview["accounts"];
  cardAccounts: HomeOverview["cardAccounts"];
  balancesVisible?: boolean;
};

export function HomeAccountsCarousel({
  accounts,
  cardAccounts,
  balancesVisible = true,
}: HomeAccountsCarouselProps) {
  const t = useTranslations("scrn-home.accountsCarousel");
  const format = useFormatter();

  function money(value: number | undefined | null) {
    const num = typeof value === "number" && !Number.isNaN(value) ? value : 0;
    return balancesVisible
      ? format.number(num, { style: "currency", currency: "BRL" })
      : "•••••";
  }

  const hasItems = accounts.length > 0 || cardAccounts.length > 0;

  if (!hasItems) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">
          {t("title")}
        </h2>
        <Link
          href="/accounts"
          className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5"
        >
          {t("viewAll")} <CaretRightIcon className="size-3.5" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1.5 -mx-4 px-4 sm:mx-0 sm:px-0">
        {/* Checking & Savings Accounts */}
        {accounts.map((acc) => {
          const balance =
            typeof acc.balance === "number" && !Number.isNaN(acc.balance)
              ? acc.balance
              : 0;

          return (
            <Link
              key={acc.id}
              href={`/accounts/${acc.id}`}
              className="w-48 shrink-0 p-4 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-primary/50 transition-colors flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-foreground truncate">
                  {acc.name}
                </span>
                <span className="size-2 rounded-full bg-positive/80" />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <WalletIcon className="size-3" />
                  {t("currentAccount")}
                </span>
                <div className="font-heading text-base font-bold text-foreground mt-0.5 tabular-nums whitespace-nowrap">
                  {money(balance)}
                </div>
              </div>
            </Link>
          );
        })}

        {/* Credit Card Accounts */}
        {cardAccounts.map((card) => {
          const balance =
            typeof card.currentInvoiceBalance === "number" && !Number.isNaN(card.currentInvoiceBalance)
              ? card.currentInvoiceBalance
              : 0;

          return (
            <Link
              key={card.id}
              href="/cards"
              className="w-52 shrink-0 p-4 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-primary/50 transition-colors flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-foreground truncate">
                  {card.name}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/10 text-warning">
                  {t("creditCard")}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CreditCardIcon className="size-3" />
                  {t("currentInvoice")}
                </span>
                <div className="font-heading text-base font-bold text-foreground mt-0.5 tabular-nums whitespace-nowrap">
                  {money(balance)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
