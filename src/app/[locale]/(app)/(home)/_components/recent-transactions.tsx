"use client";

import { createElement } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { DATE_ONLY_FORMAT_OPTIONS } from "@/lib/date";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { resolveCategoryColorClasses } from "@/lib/category-color";
import type { HomeOverview } from "../_types/types";

type RecentTransactionsProps = {
  transactions: HomeOverview["recentTransactions"];
};

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const t = useTranslations("scrn-home");
  const format = useFormatter();

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card border border-border/80 p-5 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{t("recentTransactions.title")}</h2>
        <Link
          href="/transactions"
          className="shrink-0 text-xs font-medium text-primary transition-colors hover:underline"
        >
          {t("recentTransactions.viewAll")}
        </Link>
      </div>

      {transactions.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("recentTransactions.empty")}</p>
      ) : (
        <div className="flex flex-col divide-y divide-border/60">
          {transactions.map((transaction) => {
            const color = resolveCategoryColorClasses(transaction.categoryColorStyle);
            const Icon = resolveCategoryIcon(transaction.categoryIcon);
            // The date rides in this context line rather than under the
            // amount: the row's right edge stays a single value, which is
            // what keeps the list scannable at phone width, and nothing
            // is dropped to get there.
            const subtitleParts = [
              transaction.categoryName,
              transaction.accountName,
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
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {transaction.description}
                  </span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {subtitleParts.join(" • ")}
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-heading text-sm font-semibold tabular-nums",
                    transaction.amount < 0 ? "text-negative" : "text-positive",
                  )}
                >
                  {format.number(transaction.amount, { style: "currency", currency: "BRL" })}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <Link
        href="/transactions"
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/50"
      >
        {t("recentTransactions.addNew")}
      </Link>
    </div>
  );
}
