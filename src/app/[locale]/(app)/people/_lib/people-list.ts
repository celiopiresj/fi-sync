import { matchesSearch } from "@/lib/normalize-search";
import { BRL, add, dinero, toDecimal, type Dinero } from "dinero.js";
import type {
  BalanceStatus,
  BalanceStatusFilter,
  PeopleSummary,
  PersonRow,
} from "../_types/types";

// Positive balance = the user owes this person, negative = this person
// owes the user (see listPeople in actions.ts).
export function balanceStatusOf(balance: number): BalanceStatus {
  if (balance > 0) return "toPay";
  if (balance < 0) return "toReceive";
  return "settled";
}

// The figure shown to the user: "+" when the person owes the user,
// "-" when the user owes the person, which is the opposite of the stored
// sign. Kept as a number so the caller formats it with useFormatter.
export function displayBalanceOf(balance: number): number {
  return balance === 0 ? 0 : -balance;
}

function toCents(value: number): Dinero<number> {
  return dinero({ amount: Math.round(Math.abs(value) * 100), currency: BRL });
}

// Totals for the list header. The self ("Eu") person is skipped: a
// balance against yourself isn't a debt in either direction.
export function summarizePeople(people: PersonRow[]): PeopleSummary {
  let toReceive = toCents(0);
  let toPay = toCents(0);
  let pendingCount = 0;

  for (const person of people) {
    if (person.isSelf) continue;
    if (person.balance < 0) toReceive = add(toReceive, toCents(person.balance));
    if (person.balance > 0) toPay = add(toPay, toCents(person.balance));
    if (person.balance !== 0) pendingCount += 1;
  }

  return {
    totalToReceive: Number(toDecimal(toReceive)),
    totalToPay: Number(toDecimal(toPay)),
    pendingCount,
  };
}

// Search by name (accent-insensitive) or by phone digits, then narrow by
// the selected balance tab.
export function filterPeople(
  people: PersonRow[],
  searchText: string,
  status: BalanceStatusFilter,
): PersonRow[] {
  const query = searchText.trim().toLowerCase();
  const queryDigits = query.replace(/\D/g, "");

  return people.filter((person) => {
    const matchesName = matchesSearch(person.name, query);
    const phoneDigits = `${person.phoneCountryCode ?? ""}${person.phone ?? ""}`;
    const matchesPhone =
      queryDigits.length > 0 && phoneDigits.includes(queryDigits);
    if (query && !matchesName && !matchesPhone) return false;

    return status === "all" || balanceStatusOf(person.balance) === status;
  });
}
