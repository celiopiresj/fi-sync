import { BRL, add, dinero, toDecimal, type Dinero } from "dinero.js";
import { accountTypeValues } from "../_schema/schema";
import type { AccountGroup, AccountRow, AccountsSummary } from "../_types/types";

function toDinero(value: number) {
  return dinero({ amount: Math.round(value * 100), currency: BRL });
}

function sumBalances(accounts: AccountRow[]): number {
  const total = accounts.reduce<Dinero<number>>(
    (sum, account) => add(sum, toDinero(account.balance)),
    toDinero(0),
  );
  return Number(toDecimal(total));
}

// Fixed CHECKING -> SAVINGS -> CASH section order regardless of data;
// within a section, active accounts first, then inactive (archived ones
// sink to the bottom instead of interleaving), each alphabetically.
export function groupAccountsByType(accounts: AccountRow[]): AccountGroup[] {
  return accountTypeValues.map((type) => {
    const ofType = accounts
      .filter((account) => account.type === type)
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "INACTIVE" ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });
    return { type, accounts: ofType, balance: sumBalances(ofType) };
  });
}

// Same figure the home screen's "Saldo total" shows (the sum of every
// checking/savings/cash account listAccounts returns), so the two screens
// never disagree.
export function summarizeAccounts(accounts: AccountRow[]): AccountsSummary {
  return {
    totalBalance: sumBalances(accounts),
    accountsCount: accounts.length,
  };
}
