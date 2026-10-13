import { add, BRL, dinero, subtract, toDecimal, type Dinero } from "dinero.js";

type ScopableRow = {
  amount: number;
  splits: { personId: string; amount: number }[];
};

function toDinero(value: number): Dinero<number> {
  return dinero({ amount: Math.round(value * 100), currency: BRL });
}

// With a person filter on, a split purchase should read as just that
// person's part: the row keeps only their split, and its amount becomes
// their share — so the list, the day totals and the summary cards all
// add up to what that person spent, not everyone's full purchases.
// A row with no splits is the user's own (the self Person) and stays
// as-is; for the self Person, whatever the splits don't cover is also
// theirs (same rule payInvoice uses). Display-only: edits must still go
// through the original row (see transactions-view.tsx).
export function scopeRowsToPerson<T extends ScopableRow>(
  rows: T[],
  personId: string,
  isSelf: boolean,
): T[] {
  return rows.map((row) => {
    if (row.splits.length === 0) return row;
    const own = row.splits.filter((split) => split.personId === personId);
    let share = own.reduce((sum, split) => add(sum, toDinero(split.amount)), toDinero(0));
    if (isSelf) {
      const attributed = row.splits.reduce(
        (sum, split) => add(sum, toDinero(split.amount)),
        toDinero(0),
      );
      share = add(share, subtract(toDinero(row.amount), attributed));
    }
    return { ...row, amount: Number(toDecimal(share)), splits: own };
  });
}
