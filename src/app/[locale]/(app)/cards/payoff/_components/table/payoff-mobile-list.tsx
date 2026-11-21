"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import type { PayoffItem } from "../../_types/types";
import { MoneyCell, ParcelSummary, PurchaseCell } from "./payoff-cells";

type PayoffMobileListProps = {
  items: PayoffItem[];
  emptyState: ReactNode;
};

export function PayoffMobileList({ items, emptyState }: PayoffMobileListProps) {
  if (items.length === 0) return <>{emptyState}</>;

  return (
    <Card className="gap-0 py-0">
      <div className="divide-y divide-border/60">
        {items.map((item) => (
          <div key={item.key} className="flex flex-col gap-1 p-4">
            <div className="flex items-start justify-between gap-3">
              <PurchaseCell item={item} />
              <MoneyCell value={item.total} className="shrink-0 text-sm font-semibold" />
            </div>
            {item.kind === "purchase" && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="min-w-0 break-words">{item.people.join(", ")}</span>
                <ParcelSummary item={item} />
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
