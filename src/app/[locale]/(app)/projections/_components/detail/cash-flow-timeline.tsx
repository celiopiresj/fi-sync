"use client";

import { useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { filterMainMilestones } from "../../_lib/cash-flow-timeline";
import type { CashFlowMilestone } from "../../_types/types";

type CashFlowTimelineProps = {
  milestones: CashFlowMilestone[];
  monthLabel: string;
};

export function CashFlowTimeline({ milestones, monthLabel }: CashFlowTimelineProps) {
  const t = useTranslations("scrn-projections.detail.timeline");
  const format = useFormatter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filterMode, setFilterMode] = useState<"main" | "all">("main");

  const mainMilestones = useMemo(
    () => filterMainMilestones(milestones),
    [milestones],
  );

  const displayedMilestones = filterMode === "main" ? mainMilestones : milestones;

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const offset = direction === "left" ? -340 : 340;
    scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
  }

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

  // Gera a narrativa inteligente da trajetória
  const narrative = useMemo(() => {
    if (milestones.length <= 1) return null;

    function formatCurrency(val: number) {
      return format.number(Math.abs(val), {
        style: "currency",
        currency: "BRL",
      });
    }

    let firstPositive: CashFlowMilestone | null = null;
    let lastPositive: CashFlowMilestone | null = null;
    let maxPositiveBalance = 0;
    let criticalTurn: CashFlowMilestone | null = null;

    for (const m of milestones) {
      if (m.balanceAfter > 0) {
        if (!firstPositive) firstPositive = m;
        lastPositive = m;
        if (m.balanceAfter > maxPositiveBalance) {
          maxPositiveBalance = m.balanceAfter;
        }
      } else if (firstPositive && !criticalTurn) {
        criticalTurn = m;
      }
    }

    if (firstPositive && lastPositive && criticalTurn) {
      return `O caixa fica positivo entre os dias ${firstPositive.dateLabel} e ${lastPositive.dateLabel} (+${formatCurrency(maxPositiveBalance)}), mas entra em déficit no dia ${criticalTurn.dateLabel} devido a ${criticalTurn.title.toLowerCase()}.`;
    }

    if (firstPositive && !criticalTurn) {
      return `O fluxo de caixa permanece saudável e positivo ao longo de todo o mês de ${monthLabel}.`;
    }

    const firstDeficit = milestones.find((m) => m.balanceAfter < 0);
    if (firstDeficit) {
      return `O mês inicia e transcorre com saldo negativo acumulado, exigindo atenção às fontes de receita.`;
    }

    return null;
  }, [milestones, monthLabel, format]);

  const balanceLabel = t("balance").replace(/:$/, "");

  return (
    <Card className="w-full min-w-0 overflow-hidden rounded-2xl border-border bg-card shadow-xs">
      <CardContent className="w-full min-w-0 p-4 sm:p-5">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 pr-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">
                {t("title", { month: monthLabel })}
              </h2>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Por que o caixa fica negativo?
              </span>
            </div>
            {narrative && (
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {narrative}
              </p>
            )}
          </div>

          {/* Controles de Visualização Alinhados à Direita: Toggle de Abas no topo + Legenda abaixo */}
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <div className="flex items-center gap-2">
              {/* Toggle de Filtro Rápido */}
              {milestones.length > 7 && (
                <div className="flex items-center rounded-lg bg-muted p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setFilterMode("main")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] transition-all",
                      filterMode === "main"
                        ? "bg-card font-semibold text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Marcos principais ({mainMilestones.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] transition-all",
                      filterMode === "all"
                        ? "bg-card font-semibold text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Todos os dias ({milestones.length})
                  </button>
                </div>
              )}

              {/* Setas de rolagem quando no modo 'all' */}
              {filterMode === "all" && (
                <div className="flex items-center gap-1 border-l border-border pl-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    onClick={() => scroll("left")}
                    className="size-6 rounded-md text-muted-foreground hover:text-foreground"
                    aria-label="Rolar para esquerda"
                  >
                    <CaretLeftIcon className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    onClick={() => scroll("right")}
                    className="size-6 rounded-md text-muted-foreground hover:text-foreground"
                    aria-label="Rolar para direita"
                  >
                    <CaretRightIcon className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Legenda Alinhada à Direita */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium whitespace-nowrap">
                <span className="size-2 rounded-full bg-positive shrink-0" />
                {t("positiveBalance")}
              </span>
              <span className="flex items-center gap-1.5 font-medium whitespace-nowrap">
                <span className="size-2 rounded-full bg-rose-500 shrink-0" />
                {t("negativeBalance")}
              </span>
            </div>
          </div>
        </div>

        {/* Faixa Compacta de Marcos (Preenche 100% da largura até o final do container) ou Faixa com Scroll sem estourar o container */}
        <div className="w-full min-w-0 max-w-full overflow-hidden">
          <div
            ref={scrollRef}
            className={cn(
              "w-full min-w-0",
              filterMode === "main"
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-flow-col md:grid-rows-1 md:auto-cols-fr gap-2.5"
                : "flex gap-2.5 overflow-x-auto pb-2 pt-1 scroll-smooth scrollbar-thin snap-x",
            )}
          >
            {displayedMilestones.map((m, idx) => {
              const isPositive = m.balanceAfter >= 0;
              const isCritical = m.isCritical;

              return (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-col justify-between rounded-xl border p-3 transition-all min-w-0 min-h-[118px]",
                    filterMode === "all" ? "w-44 shrink-0 snap-start" : "w-full",
                    isCritical
                      ? "border-rose-400 bg-rose-50/80 ring-2 ring-rose-500/30 dark:border-rose-900 dark:bg-rose-950/40"
                    : isPositive
                    ? "border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-950 dark:bg-emerald-950/20"
                    : "border-rose-200/80 bg-rose-50/30 dark:border-rose-950 dark:bg-rose-950/15",
                )}
              >
                <div>
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap",
                        isCritical
                          ? "bg-rose-600 text-white"
                          : isPositive
                          ? "bg-positive text-positive-foreground"
                          : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
                      )}
                    >
                      {m.dateLabel}
                    </span>
                    {m.delta !== 0 && (
                      <span
                        className={cn(
                          "text-[11px] font-semibold tabular-nums whitespace-nowrap",
                          m.delta > 0 ? "text-positive" : "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {m.delta > 0 ? "+" : ""}
                        {Math.round(m.delta)}
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-1 line-clamp-1 text-xs font-semibold text-foreground"
                    title={m.title}
                  >
                    {m.title}
                  </p>
                  {m.subtitle && (
                    <p className="line-clamp-1 text-[11px] text-muted-foreground">
                      {m.subtitle}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-baseline justify-between border-t border-border/80 pt-2 text-[11px]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    {balanceLabel}:
                  </span>
                  <span
                    className={cn(
                      "font-bold tabular-nums whitespace-nowrap",
                      isPositive ? "text-positive" : "text-rose-600 dark:text-rose-400",
                    )}
                  >
                    {money(m.balanceAfter)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </CardContent>
  </Card>
  );
}

