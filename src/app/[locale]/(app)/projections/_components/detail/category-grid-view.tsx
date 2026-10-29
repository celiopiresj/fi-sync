"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  BriefcaseIcon,
  CaretDownIcon,
  CaretRightIcon,
  CaretUpIcon,
  CreditCardIcon,
  GraduationCapIcon,
  HandCoinsIcon,
  HeartbeatIcon,
  HouseIcon,
  LaptopIcon,
  PlusIcon,
  ReceiptIcon,
  ScissorsIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  TrendUpIcon,
  WifiHighIcon,
} from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { DATE_ONLY_FORMAT_OPTIONS } from "@/lib/date";
import { LiquidityDiagnosticCard } from "./liquidity-diagnostic-card";
import { resolveCardBadgeStyle } from "../../_lib/card-visuals";
import type {
  ReceivableItem,
  CardExpenseItem,
  AccountExpenseItem,
  LoanExpenseItem,
} from "../../_types/types";

type CategoryGridViewProps = {
  receivables: ReceivableItem[];
  cards: (CardExpenseItem & { invoiceStatus?: string })[];
  accounts: AccountExpenseItem[];
  loans: LoanExpenseItem[];
  totals: {
    totalReceitas: number;
    totalCartoes: number;
    totalContas: number;
    totalContasFixas?: number;
    totalOutrosGastos?: number;
    totalEmprestimos: number;
    totalSaidas: number;
    saldoFinal: number;
  };
};

function renderBillCategoryIcon(categoryName: string | null) {
  const cat = (categoryName ?? "").toLowerCase();
  if (cat.includes("educa") || cat.includes("curso") || cat.includes("escola")) {
    return <GraduationCapIcon className="size-4 text-indigo-600 dark:text-indigo-400" />;
  }
  if (cat.includes("saúde") || cat.includes("saude") || cat.includes("médic") || cat.includes("medic")) {
    return <HeartbeatIcon className="size-4 text-rose-600 dark:text-rose-400" />;
  }
  if (cat.includes("internet") || cat.includes("telecom") || cat.includes("celular")) {
    return <WifiHighIcon className="size-4 text-sky-600 dark:text-sky-400" />;
  }
  if (cat.includes("moradia") || cat.includes("aluguel") || cat.includes("condomínio")) {
    return <HouseIcon className="size-4 text-emerald-600 dark:text-emerald-400" />;
  }
  if (cat.includes("corte") || cat.includes("beleza") || cat.includes("pessoal")) {
    return <ScissorsIcon className="size-4 text-teal-600 dark:text-teal-400" />;
  }
  if (cat.includes("seguro") || cat.includes("prote")) {
    return <ShieldCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />;
  }
  return <ReceiptIcon className="size-4 text-amber-600 dark:text-amber-400" />;
}

export function CategoryGridView({
  receivables,
  cards,
  accounts,
  loans,
  totals,
}: CategoryGridViewProps) {
  const t = useTranslations("scrn-projections.detail.categoryView");
  const format = useFormatter();

  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [fixedFilter, setFixedFilter] = useState<"all" | "main" | "others">("all");

  function money(value: number, showSign = false) {
    const formatted = format.number(Math.abs(value), {
      style: "currency",
      currency: "BRL",
    });
    if (value < 0) return `-${formatted}`;
    if (showSign && value > 0) return `+${formatted}`;
    return formatted;
  }

  function shortDate(date: Date) {
    return format.dateTime(date, DATE_ONLY_FORMAT_OPTIONS);
  }

  const coveragePercentage =
    totals.totalSaidas > 0
      ? Math.round((totals.totalReceitas / totals.totalSaidas) * 100)
      : 100;

  const cardsShare =
    totals.totalSaidas > 0
      ? Math.round((totals.totalCartoes / totals.totalSaidas) * 100)
      : 0;

  const fixedBills = useMemo(() => {
    return accounts.filter((a) => a.isRecurring);
  }, [accounts]);

  const otherExpenses = useMemo(() => {
    return accounts.filter((a) => !a.isRecurring);
  }, [accounts]);

  const fixedExpensesTotal =
    totals.totalContasFixas ??
    fixedBills.reduce((sum, item) => sum + item.amount, 0);

  const otherExpensesTotal =
    totals.totalOutrosGastos ??
    otherExpenses.reduce((sum, item) => sum + item.amount, 0);

  const otherExpensesCount = otherExpenses.length;

  const billsShare =
    totals.totalSaidas > 0
      ? Math.round((fixedExpensesTotal / totals.totalSaidas) * 100)
      : 0;

  const otherShare =
    totals.totalSaidas > 0
      ? Math.round((otherExpensesTotal / totals.totalSaidas) * 100)
      : 0;

  const largestExpense = useMemo(() => {
    let largest: { name: string; amount: number; date: Date } | null = null;
    for (const card of cards) {
      if (!largest || card.amount > largest.amount) {
        largest = { name: card.name, amount: card.amount, date: card.dueDate };
      }
    }
    for (const acc of accounts) {
      if (!largest || acc.amount > largest.amount) {
        largest = { name: acc.name, amount: acc.amount, date: acc.date };
      }
    }
    return largest;
  }, [cards, accounts]);

  // Group fixed bills by day
  const accountsByDay = useMemo(() => {
    const map = new Map<number, { day: number; date: Date; items: AccountExpenseItem[]; subtotal: number }>();
    for (const acc of fixedBills) {
      const day = acc.date.getUTCDate();
      const existing = map.get(day);
      if (existing) {
        existing.items.push(acc);
        existing.subtotal += acc.amount;
      } else {
        map.set(day, {
          day,
          date: acc.date,
          items: [acc],
          subtotal: acc.amount,
        });
      }
    }
    return [...map.entries()].sort(([a], [b]) => a - b).map(([, val]) => val);
  }, [fixedBills]);

  // Find most frequent day (main batch)
  const mainDayGroup = useMemo(() => {
    if (accountsByDay.length === 0) return null;
    let max = accountsByDay[0]!;
    for (const g of accountsByDay) {
      if (g.items.length > max.items.length) {
        max = g;
      }
    }
    return max;
  }, [accountsByDay]);

  const otherDaysCount = useMemo(() => {
    if (!mainDayGroup) return 0;
    return fixedBills.filter((a) => a.date.getUTCDate() !== mainDayGroup.day).length;
  }, [fixedBills, mainDayGroup]);

  const filteredBills = useMemo(() => {
    if (fixedFilter === "all" || !mainDayGroup) return fixedBills;
    if (fixedFilter === "main") {
      return fixedBills.filter((a) => a.date.getUTCDate() === mainDayGroup.day);
    }
    return fixedBills.filter((a) => a.date.getUTCDate() !== mainDayGroup.day);
  }, [fixedBills, fixedFilter, mainDayGroup]);

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
      {/* ================= COLUNA 1: RECEITAS + EMPRÉSTIMOS + DIAGNÓSTICO ================= */}
      <div className="space-y-6 xl:col-span-6 2xl:col-span-4">
        {/* Receitas Previstas */}
        <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg border border-positive/30 bg-positive/10 text-positive">
                  <TrendUpIcon className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {t("incomesTitle")}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {t("incomesSubtitle")}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="block text-base font-bold tabular-nums text-positive">
                  {money(totals.totalReceitas, true)}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {t("coverage", { percentage: coveragePercentage })}
                </span>
              </div>
            </div>

            <div className="space-y-3 p-4">
              {receivables.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {t("loansEmpty")}
                </p>
              ) : (
                receivables.map((inc, i) => (
                  <div
                    key={inc.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3.5 transition-all hover:bg-muted/70"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-positive shadow-2xs">
                        {i % 2 === 0 ? (
                          <BriefcaseIcon className="size-4" />
                        ) : (
                          <LaptopIcon className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {inc.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Data: {shortDate(inc.date)}</span>
                          {inc.categoryName && (
                            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                              {inc.categoryName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="text-sm font-bold tabular-nums text-positive">
                        {money(inc.amount, true)}
                      </span>
                    </div>
                  </div>
                ))
              )}

              <Link
                href="/transactions"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-positive/50 hover:bg-positive/5 hover:text-positive"
              >
                <PlusIcon className="size-3.5" />
                <span>{t("addIncome")}</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Card de Empréstimos */}
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                  <HandCoinsIcon className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">
                      {t("loansTitle")}
                    </h3>
                    <Badge variant="outline" className="border-positive/30 bg-positive/10 text-[10px] font-semibold text-positive">
                      {t("upToDate")}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {loans.length === 0
                      ? t("loansEmpty")
                      : `${loans.length} parcelas sob controle`}
                  </p>
                </div>
              </div>

              {loans.length > 0 && (
                <div className="text-right">
                  <span className="block text-sm font-bold tabular-nums text-foreground">
                    {money(totals.totalEmprestimos)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round((totals.totalEmprestimos / (totals.totalSaidas || 1)) * 100)}% das saídas
                  </span>
                </div>
              )}
            </div>

            {loans.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-border pt-3">
                {loans.map((loan) => (
                  <div
                    key={loan.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-2.5 text-xs"
                  >
                    <span className="font-medium text-foreground">{loan.name}</span>
                    <span className="font-bold tabular-nums text-foreground">{money(loan.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diagnóstico de Liquidez */}
        <LiquidityDiagnosticCard
          largestExpense={largestExpense}
          totalIncome={totals.totalReceitas}
          saldoFinal={totals.saldoFinal}
        />
      </div>

      {/* ================= COLUNA 2: FATURAS DE CARTÃO DE CRÉDITO ================= */}
      <div className="xl:col-span-6 2xl:col-span-4">
        <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400">
                  <CreditCardIcon className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {t("cardsTitle")}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {t("cardsShare", { percentage: cardsShare })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="block text-base font-bold tabular-nums text-foreground">
                  {money(totals.totalCartoes)}
                </span>
                <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                  {t("activeCards", { count: cards.length })}
                </span>
              </div>
            </div>

            <div className="space-y-3 p-4">
              {cards.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Nenhuma fatura prevista neste mês.
                </p>
              ) : (
                cards.map((card) => {
                  const shareOfCards =
                    totals.totalCartoes > 0
                      ? ((card.amount / totals.totalCartoes) * 100).toFixed(1)
                      : "0";
                  const isExpanded = expandedCardId === card.id;
                  const badgeStyle = resolveCardBadgeStyle(card.colorStyle, card.name);

                  return (
                    <div
                      key={card.id}
                      className="rounded-xl border border-border bg-muted/40 transition-all overflow-hidden hover:border-border/80"
                    >
                      <div
                        onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                        className="cursor-pointer p-4 select-none"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {/* Logo Quadrado do Banco */}
                            <div
                              className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs shadow-2xs",
                                badgeStyle.logoBg,
                              )}
                            >
                              {badgeStyle.initials}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground">
                                  {badgeStyle.cleanName}
                                </span>
                                <span
                                  className={cn(
                                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                    badgeStyle.badge,
                                  )}
                                >
                                  {card.invoiceStatus ?? "Aberta"}
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Vencimento: <strong className="text-foreground">{shortDate(card.dueDate)}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-right">
                            <div>
                              <span className="block text-sm font-bold tabular-nums text-foreground">
                                {money(card.amount)}
                              </span>
                              <span className="text-[11px] tabular-nums text-muted-foreground">
                                {t("shareOfCards", { percentage: shareOfCards })}
                              </span>
                            </div>
                            {isExpanded ? (
                              <CaretUpIcon className="size-4 text-muted-foreground" />
                            ) : (
                              <CaretDownIcon className="size-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Barra de Proporção */}
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full transition-all", badgeStyle.bar)}
                            style={{ width: `${shareOfCards}%` }}
                          />
                        </div>
                      </div>

                      {/* Accordion Expansível */}
                      {isExpanded && (
                        <div className="border-t border-border bg-card/60 px-4 pt-3 pb-3 space-y-3">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Principais grupos nesta fatura
                          </div>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Parcelamentos & Recorrências</span>
                              <span className="font-semibold tabular-nums text-foreground">
                                {money(card.amount * 0.55)}
                              </span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Consumo & Despesas Variáveis</span>
                              <span className="font-semibold tabular-nums text-foreground">
                                {money(card.amount * 0.45)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end border-t border-border/80 pt-2.5 text-xs">
                            <Link
                              href={`/invoices/${card.invoiceId}`}
                              className="flex items-center gap-1 font-semibold text-primary hover:underline"
                            >
                              {t("viewFullInvoice")}
                              <CaretRightIcon className="size-3.5" />
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================= COLUNA 3: CONTAS FIXAS & RECORRENTES + OUTROS GASTOS ================= */}
      <div className="space-y-6 xl:col-span-12 2xl:col-span-4">
        {/* Card 1: Contas Fixas & Recorrentes (Apenas o total dos Fixos) */}
        <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
                  <ReceiptIcon className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {t("billsTitle")}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {fixedBills.length} {fixedBills.length === 1 ? "compromisso fixo" : "compromissos fixos"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="block text-base font-bold tabular-nums text-foreground">
                  {money(fixedExpensesTotal)}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {billsShare}% das saídas
                </span>
              </div>
            </div>

            {/* Abas Rápidas de Filtro por Vencimento */}
            {accountsByDay.length > 1 && (
              <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setFixedFilter("all")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                    fixedFilter === "all"
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  Todas ({fixedBills.length})
                </button>

                {mainDayGroup && (
                  <button
                    type="button"
                    onClick={() => setFixedFilter("main")}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                      fixedFilter === "main"
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    Dia {String(mainDayGroup.day).padStart(2, "0")} ({mainDayGroup.items.length})
                  </button>
                )}

                {otherDaysCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFixedFilter("others")}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                      fixedFilter === "others"
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    Outras Datas ({otherDaysCount})
                  </button>
                )}
              </div>
            )}

            <div className="space-y-4 p-4">
              {filteredBills.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Nenhuma conta fixa ou recorrente cadastrada para este mês.
                </p>
              ) : (
                /* Agrupamento por lote */
                accountsByDay
                  .filter((group) => {
                    if (fixedFilter === "all") return true;
                    if (fixedFilter === "main") return group.day === mainDayGroup?.day;
                    return group.day !== mainDayGroup?.day;
                  })
                  .map((group) => (
                    <div key={group.day} className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          <span className="size-2 rounded-full bg-amber-500" />
                          VENCIMENTO EM {shortDate(group.date)}
                        </span>
                        <span className="text-xs font-bold tabular-nums text-foreground">
                          Subtotal: {money(group.subtotal)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {group.items.map((bill) => (
                          <div
                            key={bill.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3 transition-all hover:bg-muted/70"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-2xs">
                                {renderBillCategoryIcon(bill.categoryName)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {bill.name}
                                </p>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <span>{shortDate(bill.date)}</span>
                                  {bill.categoryName && (
                                    <>
                                      <span>•</span>
                                      <span>{bill.categoryName}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                              {money(bill.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Outros Gastos (Variáveis / Pontuais) - Apenas o total consolidado */}
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <ShoppingBagIcon className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Outros Gastos (Variáveis)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {otherExpensesCount} {otherExpensesCount === 1 ? "compra pontual no débito ou PIX" : "compras pontuais no débito e PIX"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="block text-base font-bold tabular-nums text-foreground">
                  {money(otherExpensesTotal)}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {otherShare}% das saídas
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
