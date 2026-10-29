"use client";

import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type KpiMathRowProps = {
  initialBalance: number;
  totalReceitas: number;
  totalCartoes: number;
  totalContas: number;
  totalContasFixas?: number;
  totalOutrosGastos?: number;
  totalSaidas: number;
  saldoFinal: number;
  deficitMensal: number;
  startDateLabel: string;
  topIncomes?: Array<{ name: string; share: number; dateLabel: string }>;
};

export function KpiMathRow({
  initialBalance,
  totalReceitas,
  totalCartoes,
  totalContas,
  totalContasFixas,
  totalOutrosGastos,
  totalSaidas,
  saldoFinal,
  deficitMensal,
  startDateLabel,
  topIncomes,
}: KpiMathRowProps) {
  const t = useTranslations("scrn-projections.detail.math");
  const format = useFormatter();

  function money(value: number, showSign = false) {
    const formatted = format.number(Math.abs(value), {
      style: "currency",
      currency: "BRL",
    });
    if (value < 0) return `-${formatted}`;
    if (showSign && value > 0) return `+${formatted}`;
    return formatted;
  }

  const isInitialNegative = initialBalance < 0;
  const isFinalNegative = saldoFinal < 0;
  const isMonthNegative = deficitMensal < 0;

  const cardsShare =
    totalSaidas > 0 ? ((totalCartoes / totalSaidas) * 100).toFixed(1) : "0";
  const fixedExpenses = totalContasFixas ?? totalContas;
  const billsShare =
    totalSaidas > 0 ? ((fixedExpenses / totalSaidas) * 100).toFixed(1) : "0";
  const otherExpenses = totalOutrosGastos ?? 0;
  const otherShare =
    totalSaidas > 0 && otherExpenses > 0
      ? ((otherExpenses / totalSaidas) * 100).toFixed(1)
      : "0";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 relative">
      {/* 1. Saldo Anterior */}
      <div className="bg-card rounded-2xl p-5 border border-border/90 shadow-2xs flex flex-col justify-between relative group z-30">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("step1")}
          </span>
        </div>
        <div className="my-3">
          <div className="text-2xl font-bold text-foreground tabular-nums tracking-tight">
            {money(initialBalance)}
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
          <span>Início em {startDateLabel}</span>
          <span className={cn("font-medium", isInitialNegative ? "text-amber-600 dark:text-amber-400" : "text-positive")}>
            {isInitialNegative ? t("initialNegative") : t("initialPositive")}
          </span>
        </div>
        <div className="hidden xl:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-40 w-7 h-7 rounded-full bg-card border border-border shadow-xs items-center justify-center text-muted-foreground font-bold text-sm">
          +
        </div>
      </div>

      {/* 2. Receitas Previstas */}
      <div className="bg-card rounded-2xl p-5 border border-border/90 shadow-2xs flex flex-col justify-between relative z-20">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("step2")}
          </span>
        </div>
        <div className="my-3">
          <div className="text-2xl font-bold text-positive tabular-nums tracking-tight">
            {money(totalReceitas, true)}
          </div>
        </div>
        <div className="space-y-1.5 pt-2 border-t border-border">
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex">
            {topIncomes && topIncomes.length > 0 ? (
              <>
                <div
                  className="bg-positive h-full transition-all duration-300"
                  style={{ width: `${topIncomes[0]?.share ?? 100}%` }}
                />
                {topIncomes[1] && (
                  <div
                    className="bg-teal-400 h-full transition-all duration-300"
                    style={{ width: `${topIncomes[1].share}%` }}
                  />
                )}
              </>
            ) : (
              <div className="bg-muted h-full w-full" />
            )}
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
            {topIncomes && topIncomes.length > 0 ? (
              <>
                <span>
                  {topIncomes[0]?.share}% {topIncomes[0]?.name}
                  {topIncomes[0]?.dateLabel ? ` (${topIncomes[0].dateLabel})` : ""}
                </span>
                {topIncomes[1] && (
                  <span>
                    {topIncomes[1]?.share}% {topIncomes[1]?.name}
                    {topIncomes[1]?.dateLabel ? ` (${topIncomes[1].dateLabel})` : ""}
                  </span>
                )}
              </>
            ) : (
              <span>Sem receitas previstas no mês</span>
            )}
          </div>
        </div>
        <div className="hidden xl:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-40 w-7 h-7 rounded-full bg-card border border-border shadow-xs items-center justify-center text-muted-foreground font-bold text-sm">
          −
        </div>
      </div>

      {/* 3. Total de Saídas */}
      <div className="bg-card rounded-2xl p-5 border border-border/90 shadow-2xs flex flex-col justify-between relative z-10">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("step3")}
          </span>
        </div>
        <div className="my-3">
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums tracking-tight">
            {money(-totalSaidas)}
          </div>
        </div>
        <div className="space-y-1.5 pt-2 border-t border-border">
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex">
            <div
              className="bg-rose-500 h-full transition-all duration-300"
              style={{ width: `${cardsShare}%` }}
            />
            <div
              className="bg-amber-400 h-full transition-all duration-300"
              style={{ width: `${billsShare}%` }}
            />
            {Number(otherShare) > 0 && (
              <div
                className="bg-slate-400 h-full transition-all duration-300"
                style={{ width: `${otherShare}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              {cardsShare}% Cartões
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              {billsShare}% Fixas
            </span>
            {Number(otherShare) > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                {otherShare}% Outros
              </span>
            )}
          </div>
        </div>
        <div className="hidden xl:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-40 w-7 h-7 rounded-full bg-slate-900 text-white shadow-xs items-center justify-center font-bold text-sm">
          =
        </div>
      </div>

      {/* 4. Saldo Final Previsto */}
      <div className={cn(
        "rounded-2xl p-5 border shadow-xs flex flex-col justify-between transition-all relative z-0",
        isFinalNegative
          ? "bg-gradient-to-br from-rose-50/90 via-card to-rose-50/40 border-rose-200 dark:from-rose-950/40 dark:via-card dark:to-rose-950/20 dark:border-rose-900"
          : "bg-card border-positive/30",
      )}>
        <div>
          <span className={cn(
            "text-xs font-bold uppercase tracking-wider",
            isFinalNegative ? "text-rose-900/70 dark:text-rose-300" : "text-positive"
          )}>
            {t("step4")}
          </span>
        </div>
        <div className="my-3">
          <div className="text-2xl font-extrabold tabular-nums tracking-tight text-rose-600 dark:text-rose-400">
            {money(saldoFinal)}
          </div>
        </div>
        <div className="flex items-center justify-between text-xs pt-3 border-t border-rose-200/60 dark:border-rose-900/40">
          <span className={cn("truncate font-medium", isMonthNegative ? "text-rose-600 dark:text-rose-400" : "text-positive")}>
            {t("monthDiff", { amount: money(deficitMensal, true) })}
          </span>
          <span className={cn("text-[11px] font-medium shrink-0", isFinalNegative ? "text-rose-700 dark:text-rose-400" : "text-positive")}>
            {isFinalNegative ? "Déficit acumulado" : "Saldo positivo"}
          </span>
        </div>
      </div>
    </div>
  );
}
