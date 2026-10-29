"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CashFlowMilestone } from "../../_types/types";

type ChronologicalStatementViewProps = {
  milestones: CashFlowMilestone[];
  monthLabel: string;
};

export function ChronologicalStatementView({
  milestones,
  monthLabel,
}: ChronologicalStatementViewProps) {
  const t = useTranslations("scrn-projections.detail.timeline");
  const format = useFormatter();

  function money(value: number, showSign = false) {
    const abs = Math.abs(value);
    const formatted = format.number(abs, {
      style: "currency",
      currency: "BRL",
    });
    if (value < 0) return `-${formatted}`;
    if (showSign && value > 0) return `+${formatted}`;
    return formatted;
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-border">
      <CardContent className="p-0">
        <div className="flex flex-col justify-between gap-2 border-b border-border p-5 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-bold text-foreground">
              {t("chronologicalTitle", { month: monthLabel })}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("chronologicalSubtitle")}
            </p>
          </div>
          <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            {t("chronologicalOrder")}
          </span>
        </div>

        <div className="divide-y divide-border">
          {milestones.map((item, idx) => {
            const isCritical = item.isCritical;
            const isDeltaPositive = item.delta > 0;
            const isBalancePositive = item.balanceAfter >= 0;

            return (
              <div
                key={idx}
                className={cn(
                  "flex flex-col justify-between gap-4 p-4 px-6 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center",
                  isCritical && "bg-destructive/5",
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "flex size-12 shrink-0 flex-col items-center justify-center rounded-xl border font-bold",
                      isCritical
                        ? "border-destructive/40 bg-destructive/15 text-destructive"
                        : isDeltaPositive
                        ? "border-positive/30 bg-positive/10 text-positive"
                        : "border-border bg-muted/60 text-foreground",
                    )}
                  >
                    <span className="text-xs leading-none">
                      {String(item.day).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] uppercase font-medium opacity-80">
                      {monthLabel.slice(0, 3)}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{item.title}</p>
                      {isCritical && (
                        <span className="rounded bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
                          {t("criticalTurn")}
                        </span>
                      )}
                    </div>
                    {item.subtitle && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-8 sm:justify-end">
                  <div className="text-right">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("movement")}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        item.delta === 0
                          ? "text-muted-foreground"
                          : isDeltaPositive
                          ? "text-positive"
                          : "text-negative",
                      )}
                    >
                      {item.delta === 0 ? "—" : money(item.delta, true)}
                    </span>
                  </div>

                  <div className="min-w-30 text-right">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("accumulatedBalance")}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-extrabold tabular-nums",
                        isBalancePositive ? "text-positive" : "text-negative",
                      )}
                    >
                      {money(item.balanceAfter)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

