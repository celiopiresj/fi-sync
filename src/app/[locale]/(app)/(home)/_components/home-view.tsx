"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { KpiCard, KpiGrid, KpiPill } from "@/components/screen/kpi-card";
import { cn } from "@/lib/utils";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  PlusIcon,
  ReceiptIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import { HomeBalanceChart } from "./home-balance-chart";
import { HomeCategoryBreakdown } from "./home-category-breakdown";
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
  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }
  function percent(value: number) {
    return format.number(value / 100, { style: "percent", maximumFractionDigits: 1 });
  }

  const firstName = overview.userName.split(" ")[0];

  return (
    <div className={cn("mx-auto flex max-w-350 flex-col gap-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            {t("breadcrumb", {
              month: format.dateTime(new Date(), { year: "numeric", month: "long" }),
            })}
          </p>
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-semibold">{t("title")}</h1>
            {firstName && (
              <span className="text-sm text-muted-foreground">
                {t("greeting", { name: firstName })}
              </span>
            )}
          </div>
        </div>
        <Button asChild>
          <Link href="/transactions">
            <PlusIcon />
            {t("buttons.newTransaction")}
          </Link>
        </Button>
      </div>

      <KpiGrid>
        <KpiCard
          label={t("kpis.totalBalance")}
          value={money(overview.totalBalance)}
          icon={<WalletIcon className="size-5" />}
          subtitle={
            <span
              className={cn(
                "font-medium",
                overview.netChangeThisMonth >= 0 ? "text-positive" : "text-negative",
              )}
            >
              {overview.netChangeThisMonth >= 0 ? "↗ " : "↘ "}
              {t("kpis.totalBalanceSubtitle", { value: money(overview.netChangeThisMonth) })}
            </span>
          }
        />
        <KpiCard
          label={t("kpis.monthIncome")}
          value={money(overview.monthIncome)}
          tone="positive"
          icon={<ArrowDownLeftIcon className="size-5" />}
          subtitle={
            overview.incomeChangePercent === null ? undefined : (
              <KpiPill tone="positive">
                {t("kpis.incomeChange", { value: percent(overview.incomeChangePercent) })}
              </KpiPill>
            )
          }
        />
        <KpiCard
          label={t("kpis.monthExpenses")}
          value={money(overview.monthExpenses)}
          tone="negative"
          icon={<ArrowUpRightIcon className="size-5" />}
          subtitle={
            overview.expensesVsBudgetPercent === null ? undefined : (
              <KpiPill
                tone={overview.expensesVsBudgetPercent <= 0 ? "positive" : "negative"}
              >
                {t(
                  overview.expensesVsBudgetPercent <= 0
                    ? "kpis.underBudget"
                    : "kpis.overBudget",
                  { value: percent(Math.abs(overview.expensesVsBudgetPercent)) },
                )}
              </KpiPill>
            )
          }
        />
        <KpiCard
          label={t("kpis.invoicesDue")}
          value={money(overview.invoicesDue)}
          tone="warning"
          icon={<ReceiptIcon className="size-5" />}
          subtitle={
            <KpiPill tone="warning">
              {t("kpis.invoicesDueSubtitle", { count: overview.attention.closedInvoicesCount })}
            </KpiPill>
          }
        />
      </KpiGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-lg border border-border p-4 lg:col-span-2">
          <h2 className="text-sm font-medium">{t("chart.title")}</h2>
          <p className="mb-2 text-xs text-muted-foreground">{t("chart.subtitle")}</p>
          <HomeBalanceChart monthlyTrend={overview.monthlyTrend} />
        </div>
        <HomeCategoryBreakdown breakdown={overview.categoryBreakdown} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttentionList attention={overview.attention} />
        <RecentTransactions transactions={overview.recentTransactions} />
      </div>
    </div>
  );
}
