"use client";

import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ListNumbersIcon,
  ReceiptIcon,
  SquaresFourIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { DATE_ONLY_FORMAT_OPTIONS } from "@/lib/date";
import { capitalizeFirst } from "@/lib/capitalize-first";
import { monthKeyToDate } from "../_lib/projection-month";
import { computeCashFlowMilestones } from "../_lib/cash-flow-timeline";
import { useProjectionSimulation } from "../_hooks/use-projection-simulation";
import { KpiMathRow } from "./detail/kpi-math-row";
import { CashFlowTimeline } from "./detail/cash-flow-timeline";
import { CategoryGridView } from "./detail/category-grid-view";
import { ChronologicalStatementView } from "./detail/chronological-statement-view";
import type { ProjectionDetail } from "../_types/types";

type ProjectionDetailViewProps = {
  detail: ProjectionDetail;
};

export function ProjectionDetailView({ detail }: ProjectionDetailViewProps) {
  const t = useTranslations("scrn-projections");
  const format = useFormatter();

  const {
    viewMode,
    setViewMode,
    receivables,
    cards,
    accounts,
    loans,
    totals,
  } = useProjectionSimulation(detail);

  const monthDate = useMemo(() => monthKeyToDate(detail.monthKey), [detail.monthKey]);

  const monthLabel = useMemo(
    () =>
      capitalizeFirst(
        format.dateTime(monthDate, {
          month: "long",
          year: "numeric",
        }),
      ),
    [format, monthDate],
  );

  const startDateLabel = useMemo(
    () => format.dateTime(monthDate, DATE_ONLY_FORMAT_OPTIONS),
    [format, monthDate],
  );

  const topIncomes = useMemo(() => {
    if (receivables.length === 0 || totals.totalReceitas <= 0) return [];
    const sorted = [...receivables].sort((a, b) => b.amount - a.amount);
    return sorted.slice(0, 2).map((inc) => {
      // Limpa nomes longos de transferência para caber sem quebrar
      const cleanName = inc.name
        .replace(/^transferência\s+de\s+/i, "")
        .replace(/^transferencia\s+de\s+/i, "")
        .split("/")[0]
        ?.trim() ?? inc.name;

      const dateLabel = format.dateTime(inc.date, {
        day: "2-digit",
        month: "2-digit",
      });

      return {
        name: cleanName.length > 12 ? `${cleanName.slice(0, 10)}…` : cleanName,
        share: Math.round((inc.amount / totals.totalReceitas) * 100),
        dateLabel,
      };
    });
  }, [receivables, totals.totalReceitas, format]);

  // Combine items for timeline milestones computation
  const timelineMilestones = useMemo(() => {
    const items = [
      ...receivables.map((r) => ({
        id: r.id,
        name: r.name,
        date: r.date,
        amount: r.amount,
        type: "income" as const,
      })),
      ...cards.map((c) => ({
        id: c.id,
        name: c.name,
        date: c.dueDate,
        amount: c.amount,
        type: "expense" as const,
        isCard: true,
      })),
      ...accounts.map((a) => ({
        id: a.id,
        name: a.name,
        date: a.date,
        amount: a.amount,
        type: "expense" as const,
      })),
      ...loans.map((l) => ({
        id: l.id,
        name: l.name,
        date: l.date,
        amount: l.amount,
        type: "expense" as const,
      })),
    ];

    function formatDateLabel(date: Date) {
      const day = String(date.getUTCDate()).padStart(2, "0");
      const monthShort = format.dateTime(date, { month: "short" });
      return `${day} ${capitalizeFirst(monthShort)}`;
    }

    return computeCashFlowMilestones({
      initialBalance: detail.initialBalance,
      firstDayOfMonth: monthDate,
      items,
      formatDateLabel,
      openingTitle: t("detail.timeline.openingTitle"),
      openingSubtitle: t("detail.timeline.openingSubtitle"),
    });
  }, [
    receivables,
    cards,
    accounts,
    loans,
    detail.initialBalance,
    monthDate,
    format,
    t,
  ]);

  const isFinalNegative = totals.saldoFinal < 0;

  return (
    <div className="mx-auto flex w-full max-w-350 min-w-0 flex-col gap-6">
      {/* Cabeçalho da Página e Controles */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-start gap-3.5">
          <Button asChild variant="ghost" size="icon-sm" className="mt-1">
            <Link href="/projections" aria-label={t("detail.back")}>
              <ArrowLeftIcon />
            </Link>
          </Button>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                {t("detail.title", { month: monthLabel })}
              </h1>
              {isFinalNegative ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-destructive/30 bg-destructive/10 text-xs font-semibold text-destructive"
                >
                  <WarningCircleIcon className="size-3.5" />
                  {t("status.danger")}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-positive/30 bg-positive/10 text-xs font-semibold text-positive"
                >
                  <CheckCircleIcon className="size-3.5" />
                  {t("status.ok")}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("detail.subtitle")}
            </p>
          </div>
        </div>

        {/* Controles à Direita: Switcher de Visão + Mês Anterior/Próximo */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
          {/* Botão de Acesso Rápido ao Extrato */}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex gap-1.5 rounded-xl text-xs font-semibold shadow-2xs"
          >
            <Link
              href={{
                pathname: "/transactions",
                query: {
                  month: detail.monthKey,
                  ...(detail.selfPersonId ? { person: detail.selfPersonId } : {}),
                },
              }}
            >
              <ReceiptIcon className="size-3.5 text-muted-foreground" />
              <span>{t("detail.viewStatement")}</span>
            </Link>
          </Button>

          {/* Switcher de Visualização */}
          <div className="flex items-center rounded-xl bg-muted p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode("category")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
                viewMode === "category"
                  ? "bg-card font-semibold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <SquaresFourIcon className="size-3.5" />
              <span>{t("detail.viewMode.category")}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
                viewMode === "timeline"
                  ? "bg-card font-semibold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ListNumbersIcon className="size-3.5" />
              <span>{t("detail.viewMode.timeline")}</span>
            </button>
          </div>

          {/* Navegador de Mês */}
          {(detail.previousMonthId || detail.nextMonthId) && (
            <div className="flex items-center rounded-xl border border-border bg-card p-0.5">
              <Button
                variant="ghost"
                size="icon-xs"
                asChild
                disabled={!detail.previousMonthId}
              >
                {detail.previousMonthId ? (
                  <Link
                    href={`/projections/${detail.previousMonthId}`}
                    aria-label={t("detail.nav.previous")}
                  >
                    <CaretLeftIcon className="size-4" />
                  </Link>
                ) : (
                  <span aria-hidden>
                    <CaretLeftIcon className="size-4 text-muted-foreground" />
                  </span>
                )}
              </Button>
              <span className="px-2 text-xs font-semibold text-foreground">
                {monthLabel}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                asChild
                disabled={!detail.nextMonthId}
              >
                {detail.nextMonthId ? (
                  <Link
                    href={`/projections/${detail.nextMonthId}`}
                    aria-label={t("detail.nav.next")}
                  >
                    <CaretRightIcon className="size-4" />
                  </Link>
                ) : (
                  <span aria-hidden>
                    <CaretRightIcon className="size-4 text-muted-foreground" />
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 4 KPI Cards Conectados Matematicamente */}
      <KpiMathRow
        initialBalance={detail.initialBalance}
        totalReceitas={totals.totalReceitas}
        totalCartoes={totals.totalCartoes}
        totalContas={totals.totalContas}
        totalContasFixas={totals.totalContasFixas}
        totalOutrosGastos={totals.totalOutrosGastos}
        totalSaidas={totals.totalSaidas}
        saldoFinal={totals.saldoFinal}
        deficitMensal={totals.variacaoMensal}
        startDateLabel={startDateLabel}
        topIncomes={topIncomes}
      />

      {/* Trajetória Diária do Saldo */}
      <CashFlowTimeline
        milestones={timelineMilestones}
        monthLabel={monthLabel}
      />

      {/* Visão Alternável: Por Categoria ou Fluxo Diário */}
      {viewMode === "category" ? (
        <CategoryGridView
          receivables={receivables}
          cards={cards}
          accounts={accounts}
          loans={loans}
          totals={totals}
        />
      ) : (
        <ChronologicalStatementView
          milestones={timelineMilestones}
          monthLabel={monthLabel}
        />
      )}

      {/* Botão de Acesso ao Extrato Completo */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground shadow-2xs">
            <ReceiptIcon className="size-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">
              Extrato detalhado do mês
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Consulte todos os lançamentos reais e agendados deste período na tela de transações
            </p>
          </div>
        </div>

        <Button asChild variant="outline" size="sm" className="gap-2 rounded-xl text-xs font-semibold shadow-2xs shrink-0">
          <Link
            href={{
              pathname: "/transactions",
              query: {
                month: detail.monthKey,
                ...(detail.selfPersonId ? { person: detail.selfPersonId } : {}),
              },
            }}
          >
            <span>{t("detail.viewStatement")}</span>
            <ArrowRightIcon className="size-3.5 text-muted-foreground" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
