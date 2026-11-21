"use client";

import { createElement } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SectionCard, SectionLink } from "@/components/screen/section-card";
import { cn } from "@/lib/utils";
import { DATE_ONLY_FORMAT_OPTIONS } from "@/lib/date";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { resolveCategoryColorClasses } from "@/lib/category-color";
import { useHomeMoney } from "../_hooks/use-home-money";
import type { HomeOverview } from "../_types/types";

type RecentTransactionsProps = {
  transactions: HomeOverview["recentTransactions"];
  balancesVisible?: boolean;
  className?: string;
};

export function RecentTransactions({
  transactions,
  balancesVisible = true,
  className,
}: RecentTransactionsProps) {
  const t = useTranslations("scrn-home");
  const format = useFormatter();
  const money = useHomeMoney(balancesVisible);

  return (
    <SectionCard
      title={t("recentTransactions.title")}
      action={<SectionLink href="/transactions">{t("recentTransactions.viewAll")}</SectionLink>}
      className={className}
    >

      {transactions.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("recentTransactions.empty")}</p>
      ) : (
        <div className="flex flex-col divide-y divide-border/60">
          {transactions.map((transaction) => {
            const color = resolveCategoryColorClasses(transaction.categoryColorStyle);
            const Icon = resolveCategoryIcon(transaction.categoryIcon);
            // Category, how it was paid (naming the card for a credit-card
            // purchase) and the date. Each is rendered once: stacked one per
            // line on phones, joined on one line with "•" from `sm` up.
            const details = [
              transaction.categoryName,
              transaction.paymentMethod === "CREDIT_CARD" && transaction.cardName
                ? t("recentTransactions.creditCardNamed", { name: transaction.cardName })
                : transaction.paymentMethod
                  ? t(`recentTransactions.paymentMethod.${transaction.paymentMethod}`)
                  : null,
              format.dateTime(transaction.date, DATE_ONLY_FORMAT_OPTIONS),
            ].filter((part): part is string => Boolean(part));

            return (
              <div key={transaction.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    color.badge,
                  )}
                >
                  {createElement(Icon, { className: "size-4.5" })}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="min-w-0 break-words text-sm font-medium text-foreground">
                    {transaction.description}
                  </span>
                  <span className="flex min-w-0 flex-col text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-1.5">
                    {details.map((detail, index) => (
                      <span key={index} className="flex min-w-0 items-center gap-x-1.5">
                        {index > 0 && (
                          <span aria-hidden className="hidden sm:inline">
                            •
                          </span>
                        )}
                        <span className="break-words">{detail}</span>
                      </span>
                    ))}
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-heading text-sm font-semibold tabular-nums",
                    transaction.amount < 0 ? "text-negative" : "text-positive",
                  )}
                >
                  {money(transaction.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <Link
        href="/transactions"
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50"
      >
        {t("recentTransactions.addNew")}
      </Link>
    </SectionCard>
  );
}
