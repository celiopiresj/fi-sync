import type { getProjectionDetail, getProjections } from "../actions";

export type ProjectionEntry = Awaited<ReturnType<typeof getProjections>>[number];
export type RiskStatus = ProjectionEntry["status"];

export type ProjectionDetail = NonNullable<
  Awaited<ReturnType<typeof getProjectionDetail>>
>;
export type CardExpenseItem = ProjectionDetail["cardsBreakdown"][number];
export type AccountExpenseItem = ProjectionDetail["accountsBreakdown"][number];
