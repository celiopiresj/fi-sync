"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/screen/page-header";
import type { CardsSummary } from "../_types/types";

type CardsHeaderProps = {
  summary: CardsSummary;
  onCreate: () => void;
};

export function CardsHeader({ summary, onCreate }: CardsHeaderProps) {
  const t = useTranslations("scrn-cards");

  return (
    <PageHeader
      title={t("title")}
      subtitle={
        <>
          {t("header.activeCount", { count: summary.activeCount })} ·{" "}
          {t("header.inactiveCount", { count: summary.inactiveCount })} ·{" "}
          {t("cards.count", { count: summary.physicalCardsCount })}
        </>
      }
      right={<Button onClick={onCreate}>{t("buttons.add")}</Button>}
    />
  );
}
