// Reconciles the top-level `personId` field with the opt-in `splits`
// array into Prisma's `splits.create` input. Both the debit and the
// credit path end up with the same `{ personId, splits, type }` shape
// here (see the personId/splits comments on debitTransactionSchema in
// transactions/_schema/schema.ts), and so does the Telegram bot's own
// create path (src/lib/telegram/tools.ts) — which is why this lives here
// rather than inside transactions/actions.ts: the scaling rule below is
// subtle enough that a second copy of it would be a bug waiting to
// happen, not a convenience.
export function resolveSplitsCreateInput(
  value: {
    personId: string;
    splits: { personId: string; amount: number }[];
    type: "income" | "expense";
  },
  amount: number,
) {
  if (value.splits.length > 0) {
    // The typed splits sum to whatever total the user was actually
    // looking at when dividing — the full purchase in "total"
    // installment mode, just this one installment's share in
    // "perInstallment" mode — but `amount` is what THIS row actually
    // stores (e.g. one installment's own share, total/N). Scaling every
    // split by the same ratio keeps each person's proportional share
    // while making the splits always sum to the row's real amount,
    // instead of silently storing every installment with the FULL
    // total's split shares. Verified, real bug: a 5x installment
    // purchase split 3 ways (mode "total") stored every installment's
    // splits as the whole purchase's shares — 5x too large in
    // aggregate, and not matching the row's own (correctly divided)
    // amount at all. `rawTotal` is always > 0 here (split amounts are
    // schema-validated positive), so no divide-by-zero guard needed.
    const rawTotal = value.splits.reduce((sum, split) => sum + split.amount, 0);
    const scale = Math.abs(amount) / rawTotal;
    return value.splits.map((split) => ({
      personId: split.personId,
      amount: value.type === "expense" ? -split.amount * scale : split.amount * scale,
    }));
  }
  if (value.personId) {
    return [{ personId: value.personId, amount }];
  }
  return null;
}
