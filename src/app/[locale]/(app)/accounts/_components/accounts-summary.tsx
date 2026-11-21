"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAccountMoney } from "../_hooks/use-account-money";
import type { AccountGroup, AccountsSummary as Summary } from "../_types/types";

type AccountsSummaryProps = {
  summary: Summary;
  groups: AccountGroup[];
};

// The screen's headline, in the home's BalanceHero shape: the total
// balance large, then how it splits by account type. The split is one
// "label / amount" row per type on a phone (never three amounts on one
// line) and three columns from `sm` up; from `lg` the split sits beside
// the total instead of under it, so the card doesn't stretch a lone
// number across the full 1400px width.
export function AccountsSummary({ summary, groups }: AccountsSummaryProps) {
  const t = useTranslations("scrn-accounts");
  const money = useAccountMoney();

  return (
    <Card className="lg:flex-row lg:items-center">
      <CardContent className="flex flex-col gap-1 lg:min-w-0 lg:flex-1">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
          {t("cards.totalBalance")}
        </span>
        <span
          className={cn(
            "font-heading text-3xl font-bold tracking-tight whitespace-nowrap tabular-nums sm:text-4xl",
            summary.totalBalance < 0 ? "text-negative" : "text-foreground",
          )}
        >
          {money(summary.totalBalance)}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("cards.totalBalanceCount", { count: summary.accountsCount })}
        </span>
      </CardContent>

      <CardContent className="border-t border-border/60 pt-4 lg:flex-2 lg:border-t-0 lg:border-l lg:pt-0">
        <dl
          aria-label={t("cards.byType")}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-0"
        >
          {groups.map((group) => (
            <div
              key={group.type}
              className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:justify-start sm:gap-0.5 sm:border-l sm:border-border/60 sm:px-4 sm:first:border-l-0 sm:first:pl-0"
            >
              <dt className="min-w-0 break-words text-xs font-medium text-muted-foreground">
                {t(`fields.type.${group.type.toLowerCase()}`)}
              </dt>
              <dd
                className={cn(
                  "font-heading text-base font-semibold whitespace-nowrap tabular-nums",
                  group.balance < 0 ? "text-negative" : "text-foreground",
                )}
              >
                {money(group.balance)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
