"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { CardsSummary } from "../_types/types";

type CardsHeaderProps = {
  summary: CardsSummary;
  onCreate: () => void;
};

export function CardsHeader({ summary, onCreate }: CardsHeaderProps) {
  const t = useTranslations("scrn-cards");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("header.activeCount", { count: summary.activeCount })} ·{" "}
          {t("header.inactiveCount", { count: summary.inactiveCount })} ·{" "}
          {t("cards.count", { count: summary.physicalCardsCount })}
        </p>
      </div>
      <Button onClick={onCreate}>{t("buttons.add")}</Button>
    </div>
  );
}
