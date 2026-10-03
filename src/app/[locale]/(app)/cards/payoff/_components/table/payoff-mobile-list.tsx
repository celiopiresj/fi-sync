"use client";

import type { ReactNode } from "react";
import type { PayoffItem } from "../../_types/types";
import { MoneyCell, ParcelSummary, PurchaseCell } from "./payoff-cells";

type PayoffMobileListProps = {
  items: PayoffItem[];
  emptyState: ReactNode;
};

// Mobile counterpart to the DataTable, toggled with Tailwind hidden/block
// at the same 700px cutoff as the transactions/recurrences/invoices
// lists — both always mounted, so server and client render the same DOM.
export function PayoffMobileList({ items, emptyState }: PayoffMobileListProps) {
  if (items.length === 0) return <>{emptyState}</>;

  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {items.map((item) => (
        <div key={item.key} className="flex flex-col gap-1 p-3">
          <div className="flex items-start justify-between gap-3">
            <PurchaseCell item={item} />
            <MoneyCell value={item.total} className="shrink-0 text-sm font-semibold" />
          </div>
          {item.kind === "purchase" && (
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="min-w-0 truncate">{item.people.join(", ")}</span>
              <ParcelSummary item={item} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
