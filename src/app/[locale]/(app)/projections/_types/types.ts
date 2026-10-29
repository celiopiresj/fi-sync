import type { getProjectionDetail, getProjections } from "../actions";

export type ProjectionEntry = Awaited<ReturnType<typeof getProjections>>[number];
export type RiskStatus = ProjectionEntry["status"];

export type ProjectionDetail = NonNullable<
  Awaited<ReturnType<typeof getProjectionDetail>>
>;
export type CardExpenseItem = ProjectionDetail["cardsBreakdown"][number];
export type AccountExpenseItem = ProjectionDetail["accountsBreakdown"][number];
export type LoanExpenseItem = ProjectionDetail["loansBreakdown"][number];
export type ReceivableItem = ProjectionDetail["receivablesBreakdown"][number];

export type CashFlowMilestone = {
  day: number;
  date: Date;
  dateLabel: string;
  title: string;
  subtitle?: string;
  delta: number;
  balanceAfter: number;
  type: "start" | "income" | "expense" | "critical" | "mixed";
  isCritical: boolean;
  isPositive: boolean;
};

export type DetailViewMode = "category" | "timeline";
