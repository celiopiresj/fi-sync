import type {
  getInvestmentAccountDetail,
  listInvestmentAccounts,
  listMovementPeople,
  listTransferAccounts,
} from "../actions";

export type InvestmentAccountRow = Awaited<
  ReturnType<typeof listInvestmentAccounts>
>[number];

export type InvestmentAccountDetail = NonNullable<
  Awaited<ReturnType<typeof getInvestmentAccountDetail>>
>;
export type InvestmentMovementRow = InvestmentAccountDetail["movements"][number];

export type TransferAccountOption = Awaited<
  ReturnType<typeof listTransferAccounts>
>[number];

export type MovementPersonOption = Awaited<
  ReturnType<typeof listMovementPeople>
>[number];

// One row of "how much of this account is whose" (src/lib/account-balance.ts).
export type InvestmentPersonBalance = InvestmentAccountDetail["people"][number];
