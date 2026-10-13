import { allocate, BRL, dinero, toSnapshot } from "dinero.js";

// Same "cents beat float comparison" reasoning as debit-transaction-
// form.tsx's own toCents/centsToAmountString — the dialog's amount
// fields hold comma-decimal strings ("12,50").
export function amountStringToCents(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function centsToAmountString(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export type AllocationCandidate = {
  personId: string;
  // What this person still owes on the invoice — the most they can be
  // allocated automatically.
  remainingCents: number;
  // Set once the user typed this person's amount themselves: kept as-is,
  // only everyone else is (re)distributed around it.
  manualCents: number | null;
};

// Splits what a partial payment covers among the people it was ticked
// for, so the user never has to do the math: anyone whose amount was
// typed by hand keeps it, and whatever is left is shared among the rest
// in proportion to what each still owes (dinero.js's `allocate`, so the
// shares add back up to the cent). When the rest owe less than what's
// left, each simply gets their whole debt — the dialog then shows the
// gap as "falta distribuir" rather than overcharging anyone.
export function distributeAllocations(
  coveredCents: number,
  candidates: AllocationCandidate[],
): { personId: string; cents: number }[] {
  const manualTotal = candidates.reduce(
    (sum, candidate) => sum + (candidate.manualCents ?? 0),
    0,
  );
  const auto = candidates.filter(
    (candidate) => candidate.manualCents === null && candidate.remainingCents > 0,
  );
  const available = Math.max(0, coveredCents - manualTotal);
  const autoOwed = auto.reduce((sum, candidate) => sum + candidate.remainingCents, 0);

  const autoCents = new Map<string, number>();
  if (available >= autoOwed) {
    for (const candidate of auto) autoCents.set(candidate.personId, candidate.remainingCents);
  } else if (available > 0) {
    allocate(
      dinero({ amount: available, currency: BRL }),
      auto.map((candidate) => candidate.remainingCents),
    ).forEach((share, index) => {
      autoCents.set(auto[index]!.personId, toSnapshot(share).amount);
    });
  }

  return candidates.map((candidate) => ({
    personId: candidate.personId,
    cents: candidate.manualCents ?? autoCents.get(candidate.personId) ?? 0,
  }));
}
