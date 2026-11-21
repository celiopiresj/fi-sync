"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { KpiPill } from "@/components/screen/kpi-card";
import { cn } from "@/lib/utils";
import { useHomeMoney } from "../_hooks/use-home-money";
import { availableAfterInvoices } from "../_lib/overview-money";
import type { HomeOverview } from "../_types/types";

type BalanceHeroProps = {
  overview: HomeOverview;
  visible: boolean;
  compact?: boolean;
};

export function BalanceHero({ overview, visible, compact = false }: BalanceHeroProps) {
  const t = useTranslations("scrn-home");
  const money = useHomeMoney(visible);
  const net = overview.netChangeThisMonth;
  const available = availableAfterInvoices(overview.totalBalance, overview.invoicesDue);

  return (
    <Card className="justify-between">
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
            {t("kpis.totalBalance")}
          </span>
          <KpiPill tone={net >= 0 ? "positive" : "negative"}>
            {t("kpis.totalBalanceSubtitle", { value: money(net, { signed: true }) })}
          </KpiPill>
        </div>
        <span
          className={cn(
            "font-heading font-bold tracking-tight text-foreground tabular-nums",
            compact ? "text-3xl" : "text-4xl",
          )}
        >
          {money(overview.totalBalance)}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("kpis.totalBalanceAccounts", { count: overview.accountsCount })}
        </span>
      </CardContent>

      <CardContent className="grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
        <Link
          href="/invoices"
          className="-m-1.5 flex min-w-0 flex-col rounded-xl p-1.5 transition-colors hover:bg-muted/50"
        >
          <span className="break-words text-xs font-medium text-muted-foreground">
            {t("kpis.invoicesDue")}
          </span>
          <span
            className={cn(
              "font-heading text-base font-semibold tabular-nums",
              overview.invoicesDue > 0 ? "text-warning" : "text-foreground",
            )}
          >
            {money(overview.invoicesDue)}
          </span>
          <span className="break-words text-xs text-muted-foreground">
            {t("kpis.invoicesDueCount", { count: overview.attention.closedInvoicesCount })}
          </span>
        </Link>
        <div className="flex min-w-0 flex-col border-l border-border/60 pl-3">
          <span className="break-words text-xs font-medium text-muted-foreground">
            {t("kpis.availableAfterInvoices")}
          </span>
          <span
            className={cn(
              "font-heading text-base font-semibold tabular-nums",
              available < 0 ? "text-negative" : "text-foreground",
            )}
          >
            {money(available)}
          </span>
          <span className="break-words text-xs text-muted-foreground">
            {t("kpis.availableAfterInvoicesHint")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
