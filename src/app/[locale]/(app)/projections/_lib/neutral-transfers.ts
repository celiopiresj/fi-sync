// Transfer groups (two legs sharing a transferGroupId) whose legs cancel
// out in the user's own share — money moving between the user's own
// accounts, a balance transfer, an investment aporte/resgate, or one
// other person's money changing banks. Those stay out of the projection's
// income/expense figures: nothing was earned or spent. A transfer between
// DIFFERENT people ("Eu" → Maria, Maria → "Eu") doesn't cancel — the
// user's own share really drops or grows — so it's left out of this set
// and counted like any other lançamento.
export function neutralTransferGroupIds(
  rows: { transferGroupId: string | null; selfShare: number }[],
): Set<string> {
  const netByGroup = new Map<string, number>();
  for (const row of rows) {
    if (!row.transferGroupId) continue;
    netByGroup.set(
      row.transferGroupId,
      (netByGroup.get(row.transferGroupId) ?? 0) + row.selfShare,
    );
  }
  const neutral = new Set<string>();
  for (const [groupId, net] of netByGroup) {
    // Half a cent: both legs are stored as Decimal(12, 2), so a real
    // imbalance is never smaller than one cent.
    if (Math.abs(net) < 0.005) neutral.add(groupId);
  }
  return neutral;
}
