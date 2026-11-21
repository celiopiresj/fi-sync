"use client";

import { useTranslations } from "next-intl";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { CreditCardFace } from "@/components/screen/credit-card-face";
import { SectionCard, SectionLink } from "@/components/screen/section-card";
import { resolveTileHeaderClass } from "@/lib/card-color";
import { cn } from "@/lib/utils";
import { TONE_BAR } from "../_constants/constants";
import { useCardSelector } from "../_hooks/use-card-selector";
import { useHomeMoney } from "../_hooks/use-home-money";
import { cardUsageShare, cardUsageTone, shareBarWidth } from "../_lib/overview-money";
import type { HomeOverview } from "../_types/types";

type HomeCardsProps = {
  cards: HomeOverview["cardAccounts"];
  balancesVisible: boolean;
};

// One card at a time, drawn as a physical card with the next one peeking
// out behind it, and its spending limit underneath. Arrows and dots
// switch cards, so it works the same with a mouse and on a phone.
export function HomeCards({ cards, balancesVisible }: HomeCardsProps) {
  const t = useTranslations("scrn-home.cards");
  const money = useHomeMoney(balancesVisible);
  const selector = useCardSelector(cards);
  const card = selector.current;
  if (!card) return null;

  const share = cardUsageShare(card.used, card.limit);
  const tone = cardUsageTone(share);

  return (
    <SectionCard
      title={t("title")}
      description={t("subtitle", { count: cards.length })}
      action={<SectionLink href="/cards">{t("viewAll")}</SectionLink>}
      contentClassName="gap-4"
    >
      <div className="relative mx-auto w-full max-w-72 pt-3">
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-5 top-0 h-12 rounded-2xl opacity-40",
            selector.upcoming
              ? resolveTileHeaderClass(selector.upcoming.colorStyle)
              : "bg-muted",
          )}
        />
        <CreditCardFace
          name={card.name}
          colorStyle={card.colorStyle}
          closingDay={card.closingDay}
          dueDay={card.dueDay}
        />
      </div>

      {cards.length > 1 && (
        // Two items on the line: the dots, then both arrows as one group.
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {cards.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selector.select(index)}
                aria-label={t("show", { name: item.name })}
                aria-current={index === selector.index}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === selector.index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={selector.previous}
              aria-label={t("previous")}
            >
              <CaretLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={selector.next}
              aria-label={t("next")}
            >
              <CaretRightIcon />
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">{t("spendingLimit")}</span>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-heading text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {money(card.used)}
          </span>
          <span className="text-sm text-muted-foreground">
            {share === null ? t("noLimit") : t("usedOf", { limit: money(card.limit) })}
          </span>
        </p>
        <span className="block h-2 w-full overflow-hidden rounded-full bg-muted">
          <span
            className={cn("block h-full rounded-full transition-all", TONE_BAR[tone])}
            style={{ width: shareBarWidth(share) }}
          />
        </span>
      </div>
    </SectionCard>
  );
}
