"use client";

import { useTranslations } from "next-intl";
import { CalculatorIcon } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
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
      right={
        <div className="flex items-center gap-2">
          {/* Icon-only below `sm` so it fits beside "Novo cartão" on a
              phone; the label stays as the accessible name either way. */}
          <Button variant="outline" asChild>
            <Link href="/cards/payoff" aria-label={t("buttons.payoff")}>
              <CalculatorIcon />
              <span className="hidden sm:inline">{t("buttons.payoff")}</span>
            </Link>
          </Button>
          <Button onClick={onCreate}>{t("buttons.add")}</Button>
        </div>
      }
    />
  );
}
