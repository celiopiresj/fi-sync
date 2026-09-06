import type { ModelMessage } from "ai";
import { prisma } from "@/lib/prisma";

// How many past messages (user + assistant combined) get replayed into
// the model. Small on purpose, and it got smaller: the point is only that
// a follow-up like "sim" or "na verdade foi 45" still has the turn it
// refers to in context — not that the bot remembers last month. Every
// message here is resent on EVERY step of a tool-calling turn, so this
// number is multiplied by the step count against Groq's per-minute token
// budget; 20 turned an ordinary confirmation into a rate limit.
export const TELEGRAM_HISTORY_LIMIT = 8;

export async function loadHistory(userId: string): Promise<ModelMessage[]> {
  const rows = await prisma.telegramMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: TELEGRAM_HISTORY_LIMIT,
    select: { role: true, content: true },
  });

  // Queried newest-first (so `take` keeps the most RECENT ones, not the
  // oldest), then flipped back into chronological order for the model.
  return rows.reverse().map((row) => ({
    role: row.role === "USER" ? "user" : "assistant",
    content: row.content,
  }));
}

export async function appendTurn(
  userId: string,
  userText: string,
  assistantText: string,
) {
  await prisma.telegramMessage.createMany({
    data: [
      { userId, role: "USER", content: userText },
      { userId, role: "ASSISTANT", content: assistantText },
    ],
  });

  // Trim on write rather than with a scheduled job — there's no cron in
  // this app, and the table would otherwise grow without bound. Keeps a
  // bit more than the replay window so a trim never races a read that's
  // already in flight.
  const keep = await prisma.telegramMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: TELEGRAM_HISTORY_LIMIT * 2,
    select: { id: true },
  });
  if (keep.length === TELEGRAM_HISTORY_LIMIT * 2) {
    await prisma.telegramMessage.deleteMany({
      where: { userId, id: { notIn: keep.map((row) => row.id) } },
    });
  }
}

export async function clearHistory(userId: string) {
  await prisma.telegramMessage.deleteMany({ where: { userId } });
}
