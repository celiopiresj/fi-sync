import type { getInvestmentAccountDetail, listInvestmentAccounts } from "../actions";

export type InvestmentAccountRow = Awaited<
  ReturnType<typeof listInvestmentAccounts>
>[number];

export type InvestmentAccountDetail = NonNullable<
  Awaited<ReturnType<typeof getInvestmentAccountDetail>>
>;
export type InvestmentMovementRow = InvestmentAccountDetail["movements"][number];
