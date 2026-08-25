"use client";

import { useMemo } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useCategoryBreakdown } from "../../_hooks/use-category-breakdown";
import type { TransactionFilters } from "../../actions";

type CategoryBreakdownListProps = {
  // The screen's full current filters (same object passed to
  // listTransactions) — see useCategoryBreakdown/getCategoryExpenseBreakdown
  // for which fields actually apply.
  filters: TransactionFilters;
  onSelectCategory: (categoryId: string) => void;
};

const TOP_CATEGORY_COUNT = 4;
const OTHER_ID = "__other__";

export function CategoryBreakdownList({
  filters,
  onSelectCategory,
}: CategoryBreakdownListProps) {
  const t = useTranslations("scrn-transactions");
  const format = useFormatter();
  const { data } = useCategoryBreakdown(filters);

  // Top 4 + an "Outras" row absorbing the rest — a display-only grouping
  // over the already-small, already-aggregated server result, not a
  // second aggregation pass.
  const rows = useMemo(() => {
    if (!data || data.items.length === 0) return [];
    const top = data.items.slice(0, TOP_CATEGORY_COUNT);
    const rest = data.items.slice(TOP_CATEGORY_COUNT);
    const otherTotal = rest.reduce((sum, item) => sum + item.total, 0);
    return otherTotal > 0
      ? [...top, { id: OTHER_ID, name: t("chart.byCategory.other"), total: otherTotal }]
      : top;
  }, [data, t]);

  if (!data) return null;

  if (data.items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">{t("chart.byCategory.empty")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((item) => {
        // "Outras" folds several categories together, so clicking it
        // can't apply a single category filter the way every other row
        // can.
        const isOther = item.id === OTHER_ID;
        const share =
          data.totalExpenses > 0 ? (item.total / data.totalExpenses) * 100 : 0;

        return (
          <button
            key={item.id}
            type="button"
            disabled={isOther}
            onClick={() => onSelectCategory(item.id)}
            className="flex flex-col gap-1 text-left disabled:cursor-default"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs">{item.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {format.number(item.total, { style: "currency", currency: "BRL" })}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-destructive"
                style={{ width: `${share}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
