import type { CashFlowMilestone } from "../_types/types";

type TimelineItem = {
  id: string;
  name: string;
  date: Date;
  amount: number;
  type: "income" | "expense";
  isCard?: boolean;
  active?: boolean;
};

type ComputeMilestonesParams = {
  initialBalance: number;
  firstDayOfMonth: Date;
  items: TimelineItem[];
  formatDateLabel: (date: Date) => string;
  openingTitle: string;
  openingSubtitle: string;
};

export function computeCashFlowMilestones({
  initialBalance,
  firstDayOfMonth,
  items,
  formatDateLabel,
  openingTitle,
  openingSubtitle,
}: ComputeMilestonesParams): CashFlowMilestone[] {
  // Filter active items only
  const activeItems = items.filter((item) => item.active !== false);

  // Group by day of month
  const byDay = new Map<number, { date: Date; items: TimelineItem[] }>();

  for (const item of activeItems) {
    const day = item.date.getUTCDate();
    const existing = byDay.get(day);
    if (existing) {
      existing.items.push(item);
    } else {
      byDay.set(day, { date: item.date, items: [item] });
    }
  }

  // Sorted list of days
  const sortedDays = [...byDay.keys()].sort((a, b) => a - b);

  let runningBalance = initialBalance;
  let hasFoundCriticalTurn = false;

  const milestones: CashFlowMilestone[] = [
    {
      day: 1,
      date: firstDayOfMonth,
      dateLabel: formatDateLabel(firstDayOfMonth),
      title: openingTitle,
      subtitle: openingSubtitle,
      delta: 0,
      balanceAfter: initialBalance,
      type: "start",
      isCritical: false,
      isPositive: initialBalance >= 0,
    },
  ];

  for (const day of sortedDays) {
    const group = byDay.get(day)!;
    let incomeSum = 0;
    let expenseSum = 0;
    const descriptions: string[] = [];

    for (const item of group.items) {
      if (item.type === "income") {
        incomeSum += item.amount;
      } else {
        expenseSum += item.amount;
      }
      descriptions.push(item.name);
    }

    const delta = incomeSum - expenseSum;
    const prevBalance = runningBalance;
    runningBalance += delta;

    const isPositive = runningBalance >= 0;
    const isCritical = !hasFoundCriticalTurn && prevBalance >= 0 && runningBalance < 0;
    if (isCritical) {
      hasFoundCriticalTurn = true;
    }

    const type =
      isCritical
        ? "critical"
        : incomeSum > 0 && expenseSum > 0
        ? "mixed"
        : incomeSum > 0
        ? "income"
        : "expense";

    const title =
      group.items.length === 1
        ? group.items[0]!.name
        : descriptions.slice(0, 2).join(", ") +
          (group.items.length > 2 ? ` (+${group.items.length - 2})` : "");

    const subtitle =
      group.items.length === 1
        ? group.items[0]!.type === "income"
          ? "Entrada de recursos"
          : group.items[0]!.isCard
          ? "Vencimento de fatura"
          : "Despesa agendada"
        : `${group.items.length} lançamentos no dia`;

    milestones.push({
      day,
      date: group.date,
      dateLabel: formatDateLabel(group.date),
      title,
      subtitle,
      delta,
      balanceAfter: runningBalance,
      type,
      isCritical,
      isPositive,
    });
  }

  // If initial balance was already negative and no transition happened,
  // mark the minimum balance day as critical if there's any expense
  if (!hasFoundCriticalTurn && initialBalance < 0 && milestones.length > 1) {
    let minBalance = initialBalance;
    let minIdx = -1;
    for (let i = 1; i < milestones.length; i++) {
      if (milestones[i]!.balanceAfter < minBalance && milestones[i]!.delta < 0) {
        minBalance = milestones[i]!.balanceAfter;
        minIdx = i;
      }
    }
    if (minIdx !== -1) {
      milestones[minIdx]!.isCritical = true;
      milestones[minIdx]!.type = "critical";
    }
  }

  return milestones;
}

/**
 * Filtra e condensa os marcos para exibir apenas os 5 a 7 eventos principais
 * de viragem do mês (radar executivo em 1 linha sem quebras).
 */
export function filterMainMilestones(allMilestones: CashFlowMilestone[]): CashFlowMilestone[] {
  if (allMilestones.length <= 7) return allMilestones;

  const opening = allMilestones[0]!;
  const closing = allMilestones[allMilestones.length - 1]!;
  const critical = allMilestones.find((m) => m.isCritical);

  // Consideramos marcos candidatos todos entre a abertura e o fechamento
  const candidates = allMilestones.slice(1, allMilestones.length - 1);

  // Ordena por impacto absoluto de delta
  const byImpact = [...candidates].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // Pega os 4 maiores eventos de impacto (grandes entradas e maiores faturas)
  const topImpact = byImpact.slice(0, 4);

  // Junta marcos obrigatórios: abertura, crítico (se houver), maiores impactos e fechamento
  const selectedSet = new Set<CashFlowMilestone>();
  selectedSet.add(opening);
  if (critical) selectedSet.add(critical);
  for (const m of topImpact) selectedSet.add(m);
  selectedSet.add(closing);

  // Ordena cronologicamente
  const sorted = [...selectedSet].sort((a, b) => a.day - b.day);

  // Se ficaram até 7 marcos, retorna
  if (sorted.length <= 7) return sorted;

  // Garante no máximo 7 marcos mantendo abertura, crítico e fechamento
  return sorted.slice(0, 7);
}

