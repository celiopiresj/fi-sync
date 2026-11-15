"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ArrowsLeftRightIcon,
  BankIcon,
  PlusCircleIcon,
  PlusIcon,
  ReceiptIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { HomeBalanceChart } from "./home-balance-chart";
import { HomeCategoryBreakdown } from "./home-category-breakdown";
import { HomeAccountsCarousel } from "./home-accounts-carousel";
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

  const firstName = overview.userName.split(" ")[0];

  return (
    <div className={cn("mx-auto flex max-w-350 flex-col gap-6", className)}>
      {/* 1. Header Desktop */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            {t("breadcrumb", {
              month: format.dateTime(new Date(), { year: "numeric", month: "long" }),
            })}
          </p>
          <div className="flex items-baseline gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {t("title")}
            </h1>
            {firstName && (
              <span className="text-sm text-muted-foreground">
                {t("greeting", { name: firstName })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="rounded-xl border-border/80 shadow-xs">
            <Link href="/people">
              <UsersIcon className="size-4" />
              {t("quickActions.split")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="rounded-xl border-border/80 shadow-xs">
            <Link href="/open-finance">
              <BankIcon className="size-4" />
              {t("quickActions.sync")}
            </Link>
          </Button>
          <Button asChild className="rounded-xl shadow-xs">
            <Link href="/transactions">
              <PlusIcon />
              {t("buttons.newTransaction")}
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Top Bento Grid: Hero Card + Resumo Mensal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hero Card: Saldo Geral Total */}
        <section className="bg-card rounded-2xl border border-border/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                {t("kpis.totalBalance")}
              </span>
              <div
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  overview.netChangeThisMonth >= 0
                    ? "bg-positive/10 text-positive border border-positive/20"
                    : "bg-negative/10 text-negative border border-negative/20",
                )}
              >
                <span className="size-1.5 rounded-full bg-current" />
                <span>
                  {overview.netChangeThisMonth >= 0 ? "+" : ""}
                  {t("kpis.totalBalanceSubtitle", { value: money(overview.netChangeThisMonth) })}
                </span>
              </div>
            </div>
            <div className="font-heading text-4xl font-bold tracking-tight text-foreground tabular-nums my-2">
              {money(overview.totalBalance)}
            </div>
          </div>

          {/* 3-Column Breakdown */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border/60 mt-2">
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground truncate font-medium">
                {t("kpis.available")}
              </span>
              <span className="font-heading text-base font-semibold text-foreground mt-0.5 tabular-nums">
                {money(overview.totalBalance)}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {t("kpis.totalBalanceAccounts", { count: overview.accountsCount })}
              </span>
            </div>
            <div className="flex flex-col border-l border-border/60 pl-3">
              <span className="text-[11px] text-muted-foreground truncate font-medium">
                {t("kpis.invoicesDue")}
                {t("kpis.invoicesShort")}
              </span>
              <span className="font-heading text-base font-semibold text-warning mt-0.5 tabular-nums">
                {money(overview.invoicesDue)}
              </span>
              <span className="text-[10px] text-warning truncate">
                {t("kpis.invoicesDueCount", { count: overview.attention.closedInvoicesCount })}
              </span>
            </div>
            <div className="flex flex-col border-l border-border/60 pl-3">
              <span className="text-[11px] text-muted-foreground truncate font-medium">
                {t("kpis.monthlyBalance")}
                {t("kpis.balanceShort")}
              </span>
              <span
                className={cn(
                  "font-heading text-base font-semibold mt-0.5 tabular-nums",
                  overview.netChangeThisMonth >= 0 ? "text-positive" : "text-negative",
                )}
              >
                {overview.netChangeThisMonth >= 0 ? "+" : ""}
                {money(overview.netChangeThisMonth)}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {overview.netChangeThisMonth >= 0 ? "+ positivo" : "- saídas"}
              </span>
            </div>
          </div>
        </section>

        {/* Resumo Mensal: Bento Box */}
        <section className="bg-card rounded-2xl border border-border/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
            <span className="text-sm font-semibold text-foreground">
              Balanço do Mês
            </span>
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                overview.netChangeThisMonth >= 0 ? "text-positive" : "text-negative",
              )}
            >
              Saldo líquido: {overview.netChangeThisMonth >= 0 ? "+" : ""}
              {money(overview.netChangeThisMonth)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 my-auto">
            {/* Entradas */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-positive/10 border border-positive/15">
              <div className="size-10 rounded-xl bg-positive/15 flex items-center justify-center text-positive shrink-0">
                <ArrowDownLeftIcon className="size-5" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs text-muted-foreground">
                  {t("kpis.monthIncome")}
                </span>
                <span className="font-heading text-lg font-bold text-foreground tabular-nums whitespace-nowrap">
                  {money(overview.monthIncome)}
                </span>
              </div>
            </div>
            {/* Saídas */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-negative/10 border border-negative/15">
              <div className="size-10 rounded-xl bg-negative/15 flex items-center justify-center text-negative shrink-0">
                <ArrowUpRightIcon className="size-5" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs text-muted-foreground">
                  {t("kpis.monthExpenses")}
                </span>
                <span className="font-heading text-lg font-bold text-foreground tabular-nums whitespace-nowrap">
                  {money(overview.monthExpenses)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action bar inside Desktop summary */}
          <div className="flex items-center gap-2 pt-3 border-t border-border/60 mt-3">
            <Link
              href="/transactions"
              className="text-xs font-medium text-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              <PlusCircleIcon className="size-3.5 text-primary" />
              {t("quickActions.newTransaction")}
            </Link>
            <span className="text-border">•</span>
            <Link
              href="/transactions"
              className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowsLeftRightIcon className="size-3.5" />
              {t("quickActions.transfer")}
            </Link>
            <span className="text-border">•</span>
            <Link
              href="/people"
              className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <UsersIcon className="size-3.5" />
              {t("quickActions.split")}
            </Link>
            <span className="text-border">•</span>
            <Link
              href="/open-finance"
              className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <BankIcon className="size-3.5" />
              {t("quickActions.sync")}
            </Link>
          </div>
        </section>
      </div>

      {/* 3. Minhas Contas & Cartões (Horizontal Carousel) */}
      <HomeAccountsCarousel
        accounts={overview.accounts}
        cardAccounts={overview.cardAccounts}
      />

      {/* 4. Gráficos & Categorias */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-2xl bg-card border border-border/80 p-5 shadow-xs lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">{t("chart.title")}</h2>
          <p className="mb-2 text-xs text-muted-foreground">{t("chart.subtitle")}</p>
          <HomeBalanceChart monthlyTrend={overview.monthlyTrend} />
        </div>
        <HomeCategoryBreakdown breakdown={overview.categoryBreakdown} />
      </div>

      {/* 5. Alertas & Transações Recentes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttentionList attention={overview.attention} />
        <RecentTransactions transactions={overview.recentTransactions} />
      </div>
    </div>
  );
}
