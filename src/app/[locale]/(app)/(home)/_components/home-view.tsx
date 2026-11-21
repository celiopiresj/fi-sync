"use client";

import { useFormatter, useTranslations } from "next-intl";
import { PageHeader } from "@/components/screen/page-header";
import { SectionCard } from "@/components/screen/section-card";
import { cn } from "@/lib/utils";
import { useBalanceVisibility } from "../_hooks/use-balance-visibility";
import { BalanceHero } from "./balance-hero";
import { BalanceVisibilityToggle } from "./balance-visibility-toggle";
import { HomeHeaderActions } from "./home-quick-actions";
import { MonthSummary } from "./month-summary";
import { HomeBalanceChart } from "./home-balance-chart";
import { HomeCategoryBreakdown } from "./home-category-breakdown";
import { HomeAccounts } from "./home-accounts";
import { HomeCards } from "./home-cards";
import { AttentionList } from "./attention-list";
import { RecentTransactions } from "./recent-transactions";
import type { HomeOverview } from "../_types/types";

type HomeViewProps = {
  overview: HomeOverview;
  className?: string;
};

export function HomeView({ overview, className }: HomeViewProps) {
  const t = useTranslations("scrn-home");
  const format = useFormatter();
  const balances = useBalanceVisibility();
  const firstName = overview.userName.split(" ")[0];

  return (
    <div className={cn("mx-auto flex max-w-350 flex-col gap-6", className)}>
      <PageHeader
        eyebrow={t("breadcrumb", {
          month: format.dateTime(new Date(), { year: "numeric", month: "long" }),
        })}
        title={t("title")}
        badge={
          firstName ? (
            <span className="text-sm text-muted-foreground">
              {t("greeting", { name: firstName })}
            </span>
          ) : null
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <BalanceVisibilityToggle visible={balances.visible} onToggle={balances.toggle} />
            <HomeHeaderActions />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BalanceHero overview={overview} visible={balances.visible} />
        <MonthSummary overview={overview} visible={balances.visible} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title={t("chart.title")}
          description={t("chart.subtitle")}
          className="lg:col-span-2"
        >
          <HomeBalanceChart monthlyTrend={overview.monthlyTrend} />
        </SectionCard>
        <HomeCards
          cards={overview.cardAccounts}
          balancesVisible={balances.visible}
        />
      </div>

      {/* Same 2/3 + 1/3 split as the row above, so "Minhas contas" sits
          under "Meus cartões" at the same width. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RecentTransactions
          transactions={overview.recentTransactions}
          balancesVisible={balances.visible}
          className="lg:col-span-2"
        />
        <HomeAccounts
          accounts={overview.accounts}
          balancesVisible={balances.visible}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttentionList attention={overview.attention} balancesVisible={balances.visible} />
        <HomeCategoryBreakdown
          breakdown={overview.categoryBreakdown}
          balancesVisible={balances.visible}
        />
      </div>
    </div>
  );
}
