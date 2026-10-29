"use client";

import { useState, useMemo } from "react";
import type { ProjectionDetail, DetailViewMode } from "../_types/types";

export function useProjectionSimulation(detail: ProjectionDetail) {
  const [viewMode, setViewMode] = useState<DetailViewMode>("category");

  const receivables = detail.receivablesBreakdown;
  const cards = detail.cardsBreakdown;
  const accounts = detail.accountsBreakdown;
  const loans = detail.loansBreakdown;

  const totals = useMemo(() => {
    const totalReceitas = receivables.reduce((sum, i) => sum + i.amount, 0);
    const totalCartoes = cards.reduce((sum, i) => sum + i.amount, 0);
    const totalContas = accounts.reduce((sum, i) => sum + i.amount, 0);
    const totalContasFixas = accounts
      .filter((i) => i.isRecurring)
      .reduce((sum, i) => sum + i.amount, 0);
    const totalOutrosGastos = accounts
      .filter((i) => !i.isRecurring)
      .reduce((sum, i) => sum + i.amount, 0);
    const totalEmprestimos = loans.reduce((sum, i) => sum + i.amount, 0);

    const totalSaidas = totalCartoes + totalContas + totalEmprestimos;
    const saldoFinal = detail.initialBalance + totalReceitas - totalSaidas;
    const variacaoMensal = totalReceitas - totalSaidas;

    return {
      totalReceitas,
      totalCartoes,
      totalContas,
      totalContasFixas,
      totalOutrosGastos,
      totalEmprestimos,
      totalSaidas,
      saldoFinal,
      variacaoMensal,
    };
  }, [
    receivables,
    cards,
    accounts,
    loans,
    detail.initialBalance,
  ]);

  return {
    viewMode,
    setViewMode,
    receivables,
    cards,
    accounts,
    loans,
    totals,
  };
}
