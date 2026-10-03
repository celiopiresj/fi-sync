"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney, formatMonthShort } from "../_lib/format-payoff";
import type { PayoffMonth } from "../_types/types";

type PayoffMonthsCardProps = {
  months: PayoffMonth[];
  className?: string;
};

// How the total spreads over the coming invoices — what each month costs
// if nothing is paid off early.
export function PayoffMonthsCard({ months, className }: PayoffMonthsCardProps) {
  const t = useTranslations("scrn-card-payoff");
  const format = useFormatter();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t("months.title")}</CardTitle>
        <CardDescription>{t("months.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {months.map((month) => (
          <div key={month.monthKey} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs font-medium">
              {formatMonthShort(format, month.monthKey)}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-negative/70"
                style={{ width: `${month.barPercent}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums">
              {formatMoney(format, month.total)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
