"use client";

import { useFormatter, useTranslations } from "next-intl";
import { AccountMenu } from "@/components/nav/account-menu";
import { SectionCard } from "@/components/screen/section-card";
import { cn } from "@/lib/utils";
import { useBalanceVisibility } from "../_hooks/use-balance-visibility";
import { BalanceHero } from "./balance-hero";
import { BalanceVisibilityToggle } from "./balance-visibility-toggle";
import { HomeQuickActionsGrid } from "./home-quick-actions";
import { MonthSummary } from "./month-summary";
import { HomeBalanceChart } from "./home-balance-chart";
import { HomeCategoryBreakdown } from "./home-category-breakdown";
import { HomeAccounts } from "./home-accounts";
import { HomeCards } from "./home-cards";
import { AttentionList } from "./attention-list";
import { RecentTransactions } from "./recent-transactions";
import type { HomeOverview } from "../_types/types";

type HomeViewMobileProps = {
  overview: HomeOverview;
  className?: string;
};

export function HomeViewMobile({ overview, className }: HomeViewMobileProps) {
  const t = useTranslations("scrn-home");
  const format = useFormatter();
  const balances = useBalanceVisibility();
  const name = overview.userName;
  const firstName = name.split(" ")[0];

  return (
    <div className={cn("mx-auto flex max-w-350 flex-col gap-4 pb-6", className)}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <AccountMenu name={name} avatarSize="default" />
          <div className="flex min-w-0 flex-col">
            <h1 className="break-words font-heading text-base font-semibold text-foreground">
              {firstName ? t("greeting", { name: firstName }) : t("title")}
            </h1>
            <span className="break-words text-xs text-muted-foreground">
              {t("breadcrumb", {
                month: format.dateTime(new Date(), { year: "numeric", month: "long" }),
              })}
            </span>
          </div>
        </div>
        <BalanceVisibilityToggle visible={balances.visible} onToggle={balances.toggle} />
      </header>

      <BalanceHero overview={overview} visible={balances.visible} compact />
      <HomeQuickActionsGrid />
      <MonthSummary overview={overview} visible={balances.visible} />

      <HomeAccounts
        accounts={overview.accounts}
        balancesVisible={balances.visible}
      />
      <HomeCards
        cards={overview.cardAccounts}
        balancesVisible={balances.visible}
      />

      <AttentionList attention={overview.attention} balancesVisible={balances.visible} />

      <SectionCard title={t("chart.title")} description={t("chart.subtitle")}>
        <HomeBalanceChart monthlyTrend={overview.monthlyTrend} />
      </SectionCard>

      <HomeCategoryBreakdown
        breakdown={overview.categoryBreakdown}
        viewAllHref="/categories"
        balancesVisible={balances.visible}
      />
      <RecentTransactions
        transactions={overview.recentTransactions}
        balancesVisible={balances.visible}
      />
    </div>
  );
}
