// A transaction's real contribution to the user's own cash flow — not
// its full amount when it's split with other people. An unattributed
// transaction (no splits at all) is implicitly 100% the user's own, the
// same convention transactions/columns.tsx's `selfLabel` fallback
// already relies on. A split transaction only counts through whichever
// split belongs to the Person marked `isSelf` (people/actions.ts's
// setSelfPerson) — if there isn't one (no self split, or the user never
// designated a self Person at all), none of it is theirs.
export function selfShareAmount(
  amount: number,
  splits: { amount: number; person: { isSelf: boolean } }[],
): number {
  if (splits.length === 0) return amount;
  const selfSplit = splits.find((split) => split.person.isSelf);
  return selfSplit ? selfSplit.amount : 0;
}
