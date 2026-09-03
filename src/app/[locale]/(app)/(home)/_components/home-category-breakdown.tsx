"use client";

import { createElement, useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { resolveCategoryColorClasses } from "../_lib/category-color";
import type { HomeOverview } from "../_types/types";

// Top N real categories, straight from the server's already-sorted
// result — no synthetic "everything else" bucket: every row shown here
// is a real Category from the database (name/icon/color all sourced from
// it), not a UI-invented aggregate with a made-up label.
const TOP_CATEGORY_COUNT = 5;

type HomeCategoryBreakdownProps = {
  breakdown: HomeOverview["categoryBreakdown"];
  // Desktop links "Ver tudo" to the transactions statement (filterable
  // by category there); the mobile home screen links it straight to
  // /categories instead, matching the design prototype.
  viewAllHref?: string;
};

export function HomeCategoryBreakdown({
  breakdown,
  viewAllHref = "/transactions",
}: HomeCategoryBreakdownProps) {
  const t = useTranslations("scrn-home");
  const format = useFormatter();

  const rows = useMemo(
    () => breakdown.items.slice(0, TOP_CATEGORY_COUNT),
    [breakdown],
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{t("categoryBreakdown.title")}</h2>
        <Link
          href={viewAllHref}
          className="shrink-0 text-xs text-primary transition-colors hover:underline"
        >
          {t("categoryBreakdown.viewAll")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("categoryBreakdown.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((item) => {
            const share =
              breakdown.totalExpenses > 0
                ? (item.total / breakdown.totalExpenses) * 100
                : 0;
            const color = resolveCategoryColorClasses(item.colorStyle);
            const Icon = resolveCategoryIcon(item.icon);

            return (
              // Bar spans the full row (under the icon too) rather than
              // being indented into the text column — at phone width the
              // indented version left too little track for the smaller
              // shares to be readable against each other.
              <div key={item.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      color.badge,
                    )}
                  >
                    {createElement(Icon, { className: "size-4" })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {item.name}
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums">
                    {format.number(item.total, { style: "currency", currency: "BRL" })}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {format.number(share / 100, {
                      style: "percent",
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", color.bar)}
                    style={{ width: `${share}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
