import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// How a Telegram chat becomes "a fi-sync user": the signed-in user
// generates a one-time code on /telegram (see that route's actions.ts)
// and sends it to the bot as `/vincular <codigo>`. Until that happens the
// webhook has no way to know whose accounts/transactions a message is
// about — and must never guess.

export const LINK_CODE_TTL_MINUTES = 15;

// Ambiguity-free alphabet (no O/0, I/1, S/5) — the code gets read off a
// screen and typed into Telegram by hand.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";
const CODE_LENGTH = 8;

export function generateLinkCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

// The one lookup the webhook does on every incoming message. Returns null
// for an unknown chat — the route answers those with the link
// instructions rather than falling through to the model.
export async function findUserIdByChatId(chatId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { telegramChatId: chatId },
    select: { id: true },
  });
  return user?.id ?? null;
}

export type RedeemLinkResult =
  | { status: "linked"; userId: string }
  | { status: "invalid" }
  | { status: "expired" }
  // The code is valid, but some OTHER chat is already linked to that
  // account. Rebinding is allowed (a new phone/Telegram account is a
  // normal thing to happen) — this just reports that it replaced one.
  | { status: "rebound"; userId: string };

export async function redeemLinkCode(
  chatId: string,
  code: string,
): Promise<RedeemLinkResult> {
  const normalized = code.trim().toUpperCase();
  if (normalized.length === 0) return { status: "invalid" };

  const user = await prisma.user.findUnique({
    where: { telegramLinkCode: normalized },
    select: { id: true, telegramChatId: true, telegramLinkCodeExpiresAt: true },
  });
  if (!user) return { status: "invalid" };

  if (!user.telegramLinkCodeExpiresAt || user.telegramLinkCodeExpiresAt < new Date()) {
    return { status: "expired" };
  }

  const hadOtherChat = Boolean(user.telegramChatId) && user.telegramChatId !== chatId;

  // Whichever account was previously on this chat id loses it — the
  // column is @unique, so the update below would fail with P2002
  // otherwise. In practice this only fires when someone links a second
  // fi-sync account from the same Telegram chat.
  await prisma.user.updateMany({
    where: { telegramChatId: chatId, id: { not: user.id } },
    data: { telegramChatId: null },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      telegramChatId: chatId,
      // Single-use by construction: redeeming clears the code, so the
      // same string can never link a second chat.
      telegramLinkCode: null,
      telegramLinkCodeExpiresAt: null,
    },
  });

  return hadOtherChat
    ? { status: "rebound", userId: user.id }
    : { status: "linked", userId: user.id };
}

// Also wipes the chat history — it's this user's financial conversation,
// and unlinking is the user saying they're done with this chat.
export async function unlinkChat(chatId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { telegramChatId: chatId },
    select: { id: true },
  });
  if (!user) return false;

  await prisma.$transaction([
    prisma.telegramMessage.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({
      where: { id: user.id },
      // The pending confirmation goes with the history: after unlinking,
      // a "sim" from a re-linked chat must not be able to land on a
      // lançamento from before (src/lib/telegram/draft.ts).
      data: {
        telegramChatId: null,
        telegramLinkCode: null,
        telegramLinkCodeExpiresAt: null,
        telegramDraft: Prisma.DbNull,
        telegramDraftAt: null,
      },
    }),
  ]);
  return true;
}
