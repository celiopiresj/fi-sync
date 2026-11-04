import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { dateOnlyKey, parseCalendarDate } from "@/lib/date";

type PreviewCandidate = { id: string; date: string; amount: string | null };

// Finds, for each bank row, a transaction already in the destination with
// the same date and amount that no import receipt points to yet — usually
// one the owner entered by hand before using Open Finance. Each existing
// transaction is offered to at most one bank row, so two identical bank
// rows never get linked to the same manual entry.
export async function findExistingMatches(userId: string, accountId: string, rows: PreviewCandidate[], db: Prisma.TransactionClient = prisma) {
  const priced = rows.filter((row): row is PreviewCandidate & { amount: string } => row.amount !== null);
  const matches = new Map<string, { id: string; description: string }>();
  if (priced.length === 0) return matches;
  const candidates = await db.transaction.findMany({
    where: {
      userId, accountId, openFinanceImports: { none: {} },
      OR: priced.map((row) => ({ date: parseCalendarDate(row.date), amount: row.amount })),
    },
    select: { id: true, description: true, date: true, amount: true },
    orderBy: { createdAt: "asc" },
  });
  const used = new Set<string>();
  for (const row of priced) {
    const match = candidates.find((entry) => !used.has(entry.id) &&
      dateOnlyKey(entry.date) === row.date && entry.amount.toFixed(2) === row.amount);
    if (!match) continue;
    used.add(match.id);
    matches.set(row.id, { id: match.id, description: match.description });
  }
  return matches;
}
