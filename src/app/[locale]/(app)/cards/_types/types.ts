import type { listCreditCardAccounts } from "../actions";

export type CreditCardAccountRow = Awaited<
  ReturnType<typeof listCreditCardAccounts>
>[number];
export type CardRow = CreditCardAccountRow["cards"][number];

export type CardsSummary = {
  totalLimit: number;
  totalSpent: number;
  // Excludes disabled accounts' availableLimit — an inactive account
  // doesn't accept new purchases, so its "available" isn't really
  // spendable and would overstate the aggregate. totalLimit/totalSpent
  // stay real sums across every account (active + disabled) since those
  // reflect actual commitments either way.
  totalAvailable: number;
  overallUsagePercent: number;
  activeCount: number;
  inactiveCount: number;
  physicalCardsCount: number;
};

export type UpcomingDueGroup = {
  dueDay: number;
  daysUntilDue: number;
  accounts: CreditCardAccountRow[];
};
