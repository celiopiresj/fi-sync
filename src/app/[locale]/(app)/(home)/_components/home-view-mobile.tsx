"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AccountMenu } from "@/components/nav/account-menu";
import { cn } from "@/lib/utils";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ArrowsLeftRightIcon,
  BankIcon,
  CaretRightIcon,
  EyeIcon,
  EyeSlashIcon,
  PlusCircleIcon,
  ReceiptIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { HomeBalanceChart } from "./home-balance-chart";
import { HomeCategoryBreakdown } from "./home-category-breakdown";
import { HomeAccountsCarousel } from "./home-accounts-carousel";
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
  const [balancesVisible, setBalancesVisible] = useState(true);

  function money(value: number) {
    return balancesVisible
      ? format.number(value, { style: "currency", currency: "BRL" })
      : "•••••";
  }

  const name = overview.userName;
  const firstName = name.split(" ")[0];

  return (
    <div className={cn("mx-auto flex max-w-350 flex-col gap-4.5 pb-6", className)}>
      {/* 1. Header com Avatar & Período */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <AccountMenu name={name} avatarSize="default" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-base font-semibold text-foreground">
              {firstName ? t("greeting", { name: firstName }) : t("title")}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {t("breadcrumb", {
                month: format.dateTime(new Date(), { year: "numeric", month: "long" }),
              })}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setBalancesVisible((visible) => !visible)}
          aria-label={t(balancesVisible ? "aria.hideBalances" : "aria.showBalances")}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card border border-border/80 text-muted-foreground hover:text-foreground active:scale-95 transition-all shadow-xs"
        >
          {balancesVisible ? (
            <EyeIcon className="size-5" />
          ) : (
            <EyeSlashIcon className="size-5" />
          )}
        </button>
      </header>

      {/* 2. Hero Card: Saldo Geral Total (Stitch Glass Card) */}
      <section className="bg-card rounded-2xl border border-border/80 p-5 shadow-xs relative overflow-hidden flex flex-col gap-2">
        <div className="flex items-center justify-between">
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

        <div className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums my-1">
          {money(overview.totalBalance)}
        </div>

        {/* 3-Column Breakdown: Disponível, Faturas, Balanço */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/60">
          <div className="flex flex-col">
            <span className="text-[11px] text-muted-foreground truncate font-medium">
              {t("kpis.available")}
            </span>
            <span className="font-heading text-sm font-semibold text-foreground mt-0.5 tabular-nums">
              {money(overview.totalBalance)}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {t("kpis.totalBalanceAccounts", { count: overview.accountsCount })}
            </span>
          </div>
          <div className="flex flex-col border-l border-border/60 pl-2">
            <span className="text-[11px] text-muted-foreground truncate font-medium">
              {t("kpis.invoicesShort")}
            </span>
            <span className="font-heading text-sm font-semibold text-warning mt-0.5 tabular-nums">
              {money(overview.invoicesDue)}
            </span>
            <span className="text-[10px] text-warning truncate">
              {t("kpis.invoicesDueCount", { count: overview.attention.closedInvoicesCount })}
            </span>
          </div>
          <div className="flex flex-col border-l border-border/60 pl-2">
            <span className="text-[11px] text-muted-foreground truncate font-medium">
              {t("kpis.balanceShort")}
            </span>
            <span
              className={cn(
                "font-heading text-sm font-semibold mt-0.5 tabular-nums",
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

      {/* 3. Resumo Mensal: Bento Box (Entradas vs Saídas) */}
      <section className="bg-card rounded-2xl border border-border/80 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
          <span className="text-sm font-semibold text-foreground">
            Balanço do Mês
          </span>
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              overview.netChangeThisMonth >= 0 ? "text-positive" : "text-negative",
            )}
          >
            Saldo: {overview.netChangeThisMonth >= 0 ? "+" : ""}
            {money(overview.netChangeThisMonth)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Entradas */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-positive/10 border border-positive/15">
            <div className="size-8.5 rounded-lg bg-positive/15 flex items-center justify-center text-positive shrink-0">
              <ArrowDownLeftIcon className="size-4.5" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs text-muted-foreground">
                {t("kpis.monthIncome")}
              </span>
              <span className="text-base font-bold text-foreground tabular-nums whitespace-nowrap">
                {money(overview.monthIncome)}
              </span>
            </div>
          </div>
          {/* Saídas */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-negative/10 border border-negative/15">
            <div className="size-8.5 rounded-lg bg-negative/15 flex items-center justify-center text-negative shrink-0">
              <ArrowUpRightIcon className="size-4.5" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs text-muted-foreground">
                {t("kpis.monthExpenses")}
              </span>
              <span className="text-base font-bold text-foreground tabular-nums whitespace-nowrap">
                {money(overview.monthExpenses)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Atalhos Rápidos (Bento Grid) */}
      <section className="grid grid-cols-4 gap-2">
        <Link
          href="/transactions"
          className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl bg-card border border-border/80 shadow-xs active:scale-95 transition-transform duration-150 group text-center"
        >
          <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <PlusCircleIcon weight="bold" className="size-5" />
          </div>
          <span className="text-[10px] sm:text-[11px] font-medium leading-tight text-foreground text-center line-clamp-2 h-7 flex items-center justify-center break-words w-full">
            {t("quickActions.newTransaction")}
          </span>
        </Link>
        <Link
          href="/transactions"
          className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl bg-card border border-border/80 shadow-xs active:scale-95 transition-transform duration-150 group text-center"
        >
          <div className="size-9 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center mb-1.5 group-hover:bg-primary/20 transition-colors">
            <ArrowsLeftRightIcon weight="bold" className="size-5" />
          </div>
          <span className="text-[10px] sm:text-[11px] font-medium leading-tight text-foreground text-center line-clamp-2 h-7 flex items-center justify-center break-words w-full">
            {t("quickActions.transfer")}
          </span>
        </Link>
        <Link
          href="/people"
          className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl bg-card border border-border/80 shadow-xs active:scale-95 transition-transform duration-150 group text-center"
        >
          <div className="size-9 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center mb-1.5 group-hover:bg-primary/20 transition-colors">
            <UsersIcon weight="bold" className="size-5" />
          </div>
          <span className="text-[10px] sm:text-[11px] font-medium leading-tight text-foreground text-center line-clamp-2 h-7 flex items-center justify-center break-words w-full">
            {t("quickActions.split")}
          </span>
        </Link>
        <Link
          href="/open-finance"
          className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl bg-card border border-border/80 shadow-xs active:scale-95 transition-transform duration-150 group text-center"
        >
          <div className="size-9 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center mb-1.5 group-hover:bg-primary/20 transition-colors">
            <BankIcon weight="bold" className="size-5" />
          </div>
          <span className="text-[10px] sm:text-[11px] font-medium leading-tight text-foreground text-center line-clamp-2 h-7 flex items-center justify-center break-words w-full">
            {t("quickActions.sync")}
          </span>
        </Link>
      </section>

      {/* 5. Minhas Contas & Cartões (Horizontal Carousel) */}
      <HomeAccountsCarousel
        accounts={overview.accounts}
        cardAccounts={overview.cardAccounts}
        balancesVisible={balancesVisible}
      />

      {/* 6. Alerta de Faturas Pendentes */}
      {overview.invoicesDue > 0 && (
        <Link
          href="/invoices"
          className="flex items-center gap-3 rounded-2xl bg-card border border-border/80 p-4 shadow-xs hover:border-warning/50 transition-colors"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <ReceiptIcon className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs text-muted-foreground">{t("kpis.invoicesDue")}</span>
            <span className="font-heading text-base font-semibold tabular-nums text-warning">
              {money(overview.invoicesDue)}
            </span>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {t("kpis.invoicesDueCount", { count: overview.attention.closedInvoicesCount })}
          </span>
          <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {/* 7. Gráfico de Evolução Financeira */}
      <div className="flex flex-col gap-1 rounded-2xl bg-card border border-border/80 p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-foreground">{t("chart.title")}</h2>
        <p className="mb-2 text-xs text-muted-foreground">{t("chart.subtitle")}</p>
        <HomeBalanceChart monthlyTrend={overview.monthlyTrend} />
      </div>

      {/* 8. Categorias, Alertas & Transações Recentes */}
      <HomeCategoryBreakdown breakdown={overview.categoryBreakdown} viewAllHref="/categories" />
      <AttentionList attention={overview.attention} />
      <RecentTransactions transactions={overview.recentTransactions} />
    </div>
  );
}
