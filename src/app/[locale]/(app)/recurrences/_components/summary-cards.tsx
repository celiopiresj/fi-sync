"use client";

import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { normalizeToMonthly } from "../_lib/normalize-monthly-amount";
import type { RecurrenceRow } from "../_types/types";

type SummaryCardsProps = {
  recurrences: RecurrenceRow[];
};

// Same income/expenses/balance split as transactions' SummaryCards, but
// each amount is first normalized to its monthly-equivalent (a WEEKLY or
// DAILY rule doesn't literally happen once a month) — see
// normalizeToMonthly's own doc comment.
function sumMonthlyImpact(recurrences: RecurrenceRow[]) {
  let income = 0;
  let expenses = 0; // stays <= 0, same sign convention as Recurrence.amount
  for (const recurrence of recurrences) {
    const monthly = normalizeToMonthly(recurrence.amount, recurrence.frequency);
    if (monthly >= 0) {
      income += monthly;
    } else {
      expenses += monthly;
    }
  }
  return { income, expenses, balance: income + expenses };
}

// "Impacto Mensal Fixo" (tasks/012.md's third Open Question, answered
// "sim, adicionar"): one card, same visual language as transactions'
// balance card (big number + income/expense bar + legend) rather than
// three separate boxes — the three figures here are one coherent stat
// (a monthly income/expense/balance split), the same way that card
// already packs its own three numbers into one place.
export function SummaryCards({ recurrences }: SummaryCardsProps) {
  const t = useTranslations("scrn-recurrences");
  const format = useFormatter();

  // Only ACTIVE recurrences contribute — a finished rule has no more
  // future impact to summarize, even if the current filter is showing
  // it (e.g. Status=Todas/Finalizadas). Independent of whatever account/
  // category/type filter narrowed `recurrences` down to, same as
  // transactions' own SummaryCards reflecting whatever's currently
  // visible in the list beside it.
  const activeRecurrences = useMemo(
    () => recurrences.filter((recurrence) => recurrence.isActive),
    [recurrences],
  );

  const { income, expenses, balance } = useMemo(
    () => sumMonthlyImpact(activeRecurrences),
    [activeRecurrences],
  );

  const money = (value: number) =>
    format.number(value, { style: "currency", currency: "BRL" });

  // Bar segments are proportional to income vs. |expenses| directly, not
  // to their share of the balance — see the identical comment on
  // transactions' SummaryCards for why.
  const total = income + Math.abs(expenses);
  const incomeShare = total > 0 ? (income / total) * 100 : 50;
  const expensesShare = 100 - incomeShare;

  return (
    <div className="flex flex-col divide-y-[0.5px] divide-border rounded-lg bg-surface-1 lg:flex-row lg:divide-x-[0.5px] lg:divide-y-0">
      <div className="flex w-full min-w-0 flex-col gap-4 p-4 lg:flex-1">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("summary.title")}</span>
          <span
            className={cn(
              "text-[26px] font-medium tabular-nums",
              balance >= 0 ? "text-positive" : "text-negative",
            )}
          >
            {money(balance)}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("summary.balanceLabel")}
          </span>
        </div>

        <div className="flex h-2.5 w-full max-w-105 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-positive" style={{ width: `${incomeShare}%` }} />
          <div className="h-full bg-negative" style={{ width: `${expensesShare}%` }} />
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-foreground">
            <span className="size-2 shrink-0 rounded-full bg-positive" />
            {t("summary.incomeLabel", { value: money(income) })}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-foreground">
            <span className="size-2 shrink-0 rounded-full bg-negative" />
            {t("summary.expensesLabel", { value: money(Math.abs(expenses)) })}
          </span>
        </div>
      </div>
    </div>
  );
}
