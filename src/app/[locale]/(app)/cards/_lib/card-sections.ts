import { getUsageTier } from "./card-usage";
import type {
  CardsSummary,
  CreditCardAccountRow,
  UpcomingDueGroup,
} from "../_types/types";

// The cards screen's "Resumo" aggregate — see CardsSummary's own comment
// on why totalAvailable excludes disabled accounts while
// totalLimit/totalSpent don't.
export function buildSummary(accounts: CreditCardAccountRow[]): CardsSummary {
  let totalLimit = 0;
  let totalSpent = 0;
  let totalAvailable = 0;
  let activeCount = 0;
  let inactiveCount = 0;
  let physicalCardsCount = 0;

  for (const account of accounts) {
    totalLimit += account.limit;
    totalSpent += account.spent;
    physicalCardsCount += account.cards.length;

    if (account.status === "ACTIVE") {
      totalAvailable += account.availableLimit;
      activeCount += 1;
    } else {
      inactiveCount += 1;
    }
  }

  return {
    totalLimit,
    totalSpent,
    totalAvailable,
    overallUsagePercent: totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0,
    activeCount,
    inactiveCount,
    physicalCardsCount,
  };
}

// >= 95% usage, any status, uso% descending — a card here never also
// appears in getOtherCards below (see that function's own comment).
export function getAttentionCards(
  accounts: CreditCardAccountRow[],
): CreditCardAccountRow[] {
  return accounts
    .filter((account) => getUsageTier(account.usagePercent) === "critical")
    .sort((a, b) => b.usagePercent - a.usagePercent);
}

// Every account below the 95% attention threshold, alphabetical — the
// exclusivity counterpart to getAttentionCards above, so a card never
// renders in both the "Atenção necessária" and "Todos os cartões"
// sections at once.
export function getOtherCards(accounts: CreditCardAccountRow[]): CreditCardAccountRow[] {
  return accounts
    .filter((account) => getUsageTier(account.usagePercent) !== "critical")
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Every account (active + disabled) grouped by its dueDay, groups
// ordered by days-until-due ascending. Accounts with no dueDay (no
// CreditCardDetails yet) are skipped — nothing to group them by.
export function getUpcomingDueGroups(
  accounts: CreditCardAccountRow[],
): UpcomingDueGroup[] {
  const groups = new Map<number, CreditCardAccountRow[]>();

  for (const account of accounts) {
    if (account.dueDay === null) continue;
    const group = groups.get(account.dueDay) ?? [];
    group.push(account);
    groups.set(account.dueDay, group);
  }

  return Array.from(groups.entries())
    .map(([dueDay, groupAccounts]) => ({
      dueDay,
      // Every account in the group shares the same dueDay, and
      // daysUntilDue is a pure function of dueDay + "today" — so every
      // member's value is identical; the first is as good as any.
      daysUntilDue: groupAccounts[0].daysUntilDue ?? 0,
      accounts: groupAccounts.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
