// A transaction's real contribution to the user's own cash flow — not
// its full amount when it's split with other people. An unattributed
// transaction (no splits at all) is implicitly 100% the user's own, the
// same convention transactions/columns.tsx's `selfLabel` fallback
// already relies on. A split transaction only counts through whichever
// split belongs to the Person marked `isSelf` — every user has exactly
// one, created at sign-up (see sync-user.ts) — if there isn't one (no
// self split on this particular transaction), none of it is theirs.
export function selfShareAmount(
  amount: number,
  splits: { amount: number; person: { isSelf: boolean } }[],
): number {
  if (splits.length === 0) return amount;
  const selfSplit = splits.find((split) => split.person.isSelf);
  return selfSplit ? selfSplit.amount : 0;
}
