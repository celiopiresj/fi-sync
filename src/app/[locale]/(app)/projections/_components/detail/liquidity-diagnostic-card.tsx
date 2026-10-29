"use client";

import { useFormatter, useTranslations } from "next-intl";
import { SparkleIcon } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { DATE_ONLY_FORMAT_OPTIONS } from "@/lib/date";

type LiquidityDiagnosticCardProps = {
  largestExpense: {
    name: string;
    amount: number;
    date: Date;
  } | null;
  totalIncome: number;
  saldoFinal: number;
};

export function LiquidityDiagnosticCard({
  largestExpense,
  totalIncome,
  saldoFinal,
}: LiquidityDiagnosticCardProps) {
  const t = useTranslations("scrn-projections.detail.categoryView");
  const format = useFormatter();

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  function shortDate(date: Date) {
    return format.dateTime(date, DATE_ONLY_FORMAT_OPTIONS);
  }

  const shareOfIncome =
    largestExpense && totalIncome > 0
      ? Math.round((largestExpense.amount / totalIncome) * 100)
      : 0;

  return (
    <Card className="rounded-2xl border-0 bg-slate-900 text-white shadow-md dark:border dark:border-border dark:bg-card dark:text-card-foreground">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-positive/30 bg-positive/20 text-positive">
            <SparkleIcon className="size-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-positive">
              {t("diagnosticTitle")}
            </h4>
            {largestExpense ? (
              <>
                <p className="mt-1 text-sm font-semibold">
                  {t("diagnosticDeficit", { date: shortDate(largestExpense.date) })}
                </p>
                <p className="mt-1 text-xs text-slate-300 dark:text-muted-foreground leading-relaxed">
                  {t("diagnosticAdvice", {
                    card: largestExpense.name,
                    amount: money(largestExpense.amount),
                    percentage: shareOfIncome,
                  })}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-slate-300 dark:text-muted-foreground leading-relaxed">
                {saldoFinal >= 0
                  ? "Suas receitas projetadas superam com tranquilidade o total de saídas previstas para este mês."
                  : "Mantenha atenção às despesas agendadas para manter o equilíbrio de caixa."}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

