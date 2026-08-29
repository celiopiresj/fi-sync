import type {
  getInvestmentAccountDetail,
  listInvestmentAccounts,
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
