"use client";

import { createElement } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { DATE_ONLY_FORMAT_OPTIONS } from "@/lib/date";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { resolveCategoryColorClasses } from "../_lib/category-color";
import type { HomeOverview } from "../_types/types";

type RecentTransactionsProps = {
  transactions: HomeOverview["recentTransactions"];
};

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const t = useTranslations("scrn-home");
  const format = useFormatter();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{t("recentTransactions.title")}</h2>
        <Link
          href="/transactions"
          className="shrink-0 text-xs text-primary transition-colors hover:underline"
        >
          {t("recentTransactions.viewAll")}
        </Link>
      </div>

      {transactions.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("recentTransactions.empty")}</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {transactions.map((transaction) => {
            const color = resolveCategoryColorClasses(transaction.categoryColorStyle);
            const Icon = resolveCategoryIcon(transaction.categoryIcon);
            const subtitleParts = [transaction.categoryName, transaction.accountName].filter(
              (part): part is string => Boolean(part),
            );

            return (
              <div key={transaction.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    color.badge,
                  )}
                >
                  {createElement(Icon, { className: "size-4" })}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {transaction.description}
                  </span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {subtitleParts.join(" • ")}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      transaction.amount < 0 ? "text-negative" : "text-positive",
                    )}
                  >
                    {format.number(transaction.amount, { style: "currency", currency: "BRL" })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format.dateTime(transaction.date, DATE_ONLY_FORMAT_OPTIONS)}
                  </span>
                </div>
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
