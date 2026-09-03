"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CreditCardIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { resolveTileHeaderClass } from "../../cards/_lib/card-tile-color";
import type { WalletOverview } from "../_types/types";

type WalletCardsCarouselProps = {
  overview: WalletOverview;
};

export function WalletCardsCarousel({ overview }: WalletCardsCarouselProps) {
  const t = useTranslations("scrn-wallet");
  const format = useFormatter();

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  return (
    <div className="flex flex-col gap-2">
      <Link href="/cards" className="flex items-center justify-between gap-2 px-1">
        <span className="text-sm font-medium">{t("cards.creditCards.title")}</span>
        <span className="text-xs text-primary">{t("buttons.viewAll")}</span>
      </Link>

      {overview.cardAccounts.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">{t("cards.creditCards.empty")}</p>
      ) : (
        <div className="scr flex gap-3 overflow-x-auto pb-1">
          {overview.cardAccounts.map((account) => {
            const lastFourDigits = account.cards[0]?.lastFourDigits;
            const headerClass = resolveTileHeaderClass(account.cards[0]?.colorStyle ?? null);

            return (
              <div
                key={account.id}
                className={cn(
                  "flex w-59 shrink-0 flex-col gap-3 rounded-2xl p-4",
                  headerClass,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{account.name}</span>
                    {lastFourDigits && (
                      <span className="text-xs opacity-75">•••• {lastFourDigits}</span>
                    )}
                  </div>
                  <CreditCardIcon weight="fill" className="size-5 shrink-0 opacity-90" />
                </div>

                <span className="text-xl font-bold tabular-nums">{money(account.spent)}</span>

                <div className="flex flex-col gap-1.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-background/25">
                    <div
                      className={cn("h-full rounded-full bg-background")}
                      style={{ width: `${Math.min(100, account.usagePercent)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] opacity-80">
                    <span>{t("cards.creditCards.usage", { value: `${account.usagePercent}%` })}</span>
                    {account.dueDay !== null && (
                      <span>{t("cards.creditCards.due", { day: account.dueDay })}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
