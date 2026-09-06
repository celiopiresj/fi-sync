"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/server";
import { clearHistory } from "@/lib/telegram/history";
import { generateLinkCode, LINK_CODE_TTL_MINUTES } from "@/lib/telegram/link";

async function requireUserId() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

// Whether this account is already talking to the bot, plus the pending
// code if one was generated and hasn't expired. `chatId` itself is never
// sent to the browser — it's an identifier for a private chat and the UI
// has no use for it beyond "linked / not linked".
export async function getTelegramStatus() {
  const userId = await requireUserId();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      telegramChatId: true,
      telegramLinkCode: true,
      telegramLinkCodeExpiresAt: true,
    },
  });

  const pendingCode =
    user?.telegramLinkCode &&
    user.telegramLinkCodeExpiresAt &&
    user.telegramLinkCodeExpiresAt > new Date()
      ? user.telegramLinkCode
      : null;

  return {
    isLinked: Boolean(user?.telegramChatId),
    code: pendingCode,
    expiresAt: pendingCode ? (user?.telegramLinkCodeExpiresAt?.toISOString() ?? null) : null,
    // Optional — only used to offer a "abrir o bot" shortcut. Without it
    // the screen just tells the user to open their own bot by hand.
    botUsername: process.env.TELEGRAM_BOT_USERNAME ?? null,
    ttlMinutes: LINK_CODE_TTL_MINUTES,
  };
}

// Generating a new code invalidates whatever code was outstanding — the
// column holds one at a time, so the old string simply stops resolving.
export async function createTelegramLinkCode() {
  const userId = await requireUserId();

  const code = generateLinkCode();
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { telegramLinkCode: code, telegramLinkCodeExpiresAt: expiresAt },
  });

  revalidatePath("/telegram");
  return { error: null, code, expiresAt: expiresAt.toISOString() };
}

// The app-side twin of the bot's own /desvincular — same effect, same
// history wipe, so it doesn't matter which side the user does it from.
export async function disconnectTelegram() {
  const userId = await requireUserId();

  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramChatId: null,
      telegramLinkCode: null,
      telegramLinkCodeExpiresAt: null,
    },
  });
  await clearHistory(userId);

  revalidatePath("/telegram");
  return { error: null };
}
