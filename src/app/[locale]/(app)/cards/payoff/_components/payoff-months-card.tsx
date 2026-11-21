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
    <Card className={className ? `@container ${className}` : "@container"}>
      <CardHeader>
        <CardTitle>{t("months.title")}</CardTitle>
        <CardDescription>{t("months.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {months.map((month) => (
          <div
            key={month.monthKey}
            className="flex flex-col gap-1.5 @md:flex-row @md:items-center @md:gap-3"
          >
            <div className="flex items-center justify-between gap-2 @md:contents">
              <span className="w-16 shrink-0 text-xs font-medium">
                {formatMonthShort(format, month.monthKey)}
              </span>
              <div className="flex shrink-0 items-center justify-end gap-2 text-right @md:order-3">
                {month.paid > 0 && (
                  <span className="text-xs font-medium text-positive tabular-nums">
                    {t("months.paid", { amount: formatMoney(format, month.paid) })}
                  </span>
                )}
                <span className="w-24 text-xs font-semibold tabular-nums">
                  {formatMoney(format, month.total)}
                </span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted @md:order-2 @md:flex-1">
              {month.total > 0 ? (
                <div
                  className="h-full rounded-full bg-negative/70"
                  style={{ width: `${month.barPercent}%` }}
                />
              ) : month.paid > 0 ? (
                <div className="h-full w-full rounded-full bg-positive/40" />
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
