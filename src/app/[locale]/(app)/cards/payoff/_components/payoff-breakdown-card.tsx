"use client";

import { useFormatter } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoney } from "../_lib/format-payoff";
import type { PayoffBreakdownRow } from "../_types/types";

type PayoffBreakdownCardProps = {
  title: string;
  rows: PayoffBreakdownRow[];
};

// "Por pessoa" / "Por cartão" — the same total, split another way.
export function PayoffBreakdownCard({ title, rows }: PayoffBreakdownCardProps) {
  const format = useFormatter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3 text-sm">
            <span className={cn("min-w-0 truncate", row.highlight && "font-semibold")}>
              {row.label}
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatMoney(format, row.total)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
