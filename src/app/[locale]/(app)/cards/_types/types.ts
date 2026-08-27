import type { listCreditCardAccounts } from "../actions";

export type CreditCardAccountRow = Awaited<
  ReturnType<typeof listCreditCardAccounts>
>[number];
export type CardRow = CreditCardAccountRow["cards"][number];

export type CardsSummary = {
  // Excludes disabled accounts' own limit — a deactivated card no longer
  // accepts new purchases, so its limit isn't part of the user's real
  // committed credit anymore. totalSpent stays a real sum across every
  // account (active + disabled): money already owed on a card doesn't
  // disappear just because the card itself was turned off.
  totalLimit: number;
  totalSpent: number;
  // Same "active only" rule as totalLimit above — an inactive account's
  // available headroom isn't really spendable either.
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
