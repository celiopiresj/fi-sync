"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AccountMenu } from "@/components/nav/account-menu";
import { KpiCard, KpiGrid, KpiPill } from "@/components/screen/kpi-card";
import { cn } from "@/lib/utils";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CaretRightIcon,
  EyeIcon,
  EyeSlashIcon,
  ReceiptIcon,
} from "@phosphor-icons/react";
import { HomeBalanceChart } from "./home-balance-chart";
import { HomeCategoryBreakdown } from "./home-category-breakdown";
import { AttentionList } from "./attention-list";
import { RecentTransactions } from "./recent-transactions";
import type { HomeOverview } from "../_types/types";

type HomeViewMobileProps = {
  overview: HomeOverview;
  className?: string;
};

// Single-column "layout denso" from the design prototype — reuses the
// exact same cards HomeView (desktop) already renders for the chart,
// category breakdown, attention list and recent transactions, just
// stacked instead of gridded. Only the header + balance hero + KPI pair
// + invoices-due row are mobile-specific markup.
export function HomeViewMobile({ overview, className }: HomeViewMobileProps) {
  const t = useTranslations("scrn-home");
  const format = useFormatter();
  const [balancesVisible, setBalancesVisible] = useState(true);

  function money(value: number) {
    return balancesVisible
      ? format.number(value, { style: "currency", currency: "BRL" })
      : "•••••";
  }
  // Percentages stay visible while balances are masked — they qualify a
  // number without disclosing it, which is the whole point of the eye
  // toggle (hide the amounts, keep the screen readable).
  function percent(value: number) {
    return format.number(value / 100, { style: "percent", maximumFractionDigits: 1 });
  }

  const name = overview.userName;
  const firstName = name.split(" ")[0];

  return (
    <div className={cn("mx-auto flex max-w-350 flex-col gap-4", className)}>
      <div className="flex items-center gap-3">
        {/* The app shell's header is desktop-only (see (app)/layout.tsx),
            so this avatar carries what used to live up there: tapping it
            opens theme / language / sign out. The name comes in from the
            server via the overview, so the initials are already in the
            HTML rather than appearing after mount. */}
        <AccountMenu name={name} avatarSize="default" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-semibold">
            {firstName ? t("greeting", { name: firstName }) : t("title")}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {t("breadcrumb", {
              month: format.dateTime(new Date(), { year: "numeric", month: "long" }),
            })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setBalancesVisible((visible) => !visible)}
          aria-label={t(balancesVisible ? "aria.hideBalances" : "aria.showBalances")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground"
        >
          {balancesVisible ? (
            <EyeIcon className="size-5" />
          ) : (
            <EyeSlashIcon className="size-5" />
          )}
        </button>
      </div>

      <div className="flex flex-col gap-1 rounded-xl bg-primary p-5 text-primary-foreground">
        <span className="text-xs font-medium opacity-85">{t("kpis.totalBalance")}</span>
        <span className="text-3xl font-bold tabular-nums tracking-tight">
          {money(overview.totalBalance)}
        </span>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
              overview.netChangeThisMonth >= 0 ? "bg-white/20" : "bg-black/15",
            )}
          >
            {overview.netChangeThisMonth >= 0 ? "↗ " : "↘ "}
            {t("kpis.totalBalanceSubtitle", { value: money(overview.netChangeThisMonth) })}
          </span>
          <span className="text-xs opacity-80">
            {t("kpis.totalBalanceAccounts", { count: overview.accountsCount })}
          </span>
        </div>
      </div>

      <KpiGrid columns={2} className="grid-cols-2">
        <KpiCard
          label={t("kpis.monthIncome")}
          value={money(overview.monthIncome)}
          tone="positive"
          icon={<ArrowDownLeftIcon className="size-4" />}
          iconPlacement="inline"
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
          icon={<ArrowUpRightIcon className="size-4" />}
          iconPlacement="inline"
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
      </KpiGrid>

      <Link
        href="/invoices"
        className="flex items-center gap-3 rounded-lg border border-border p-3"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
          <ReceiptIcon className="size-4.5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-muted-foreground">{t("kpis.invoicesDue")}</span>
          <span className="text-base font-semibold tabular-nums text-warning">
            {money(overview.invoicesDue)}
          </span>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {t("kpis.invoicesDueCount", { count: overview.attention.closedInvoicesCount })}
        </span>
        <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
      </Link>

      <div className="flex flex-col gap-1 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">{t("chart.title")}</h2>
        <p className="mb-2 text-xs text-muted-foreground">{t("chart.subtitle")}</p>
        <HomeBalanceChart monthlyTrend={overview.monthlyTrend} />
      </div>

      <HomeCategoryBreakdown breakdown={overview.categoryBreakdown} viewAllHref="/categories" />
      <AttentionList attention={overview.attention} />
      <RecentTransactions transactions={overview.recentTransactions} />
    </div>
  );
}
