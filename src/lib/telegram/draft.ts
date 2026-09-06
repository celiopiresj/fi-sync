import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { LancamentoInput } from "./tools";

// The pending "posso registrar?" of a chat, and the words that answer it.
//
// A confirmation used to cost a full agent turn — several thousand tokens
// against Groq's per-minute budget — to turn the word "sim" into a write
// the previous turn had already worked out completely. The draft is that
// work, kept on the User row (see prisma/schema.prisma), so the answer is
// handled in src/app/api/telegram/route.ts before the model is ever
// called: zero tokens for the half of the flow that used to cost the most.
//
// Anything that is not a plain yes/no still goes to the model ("sim, mas
// muda pra 45" has to be re-planned, not replayed), and the stale draft is
// dropped the moment that happens (see runFiSyncAgent).

// A confirmation the user never got around to answering is worthless after
// a while, and replaying it hours later — against a different day's
// "hoje", most likely — is worse than asking again.
const DRAFT_TTL_MINUTES = 30;

type StoredDraft = { version: 1; input: LancamentoInput };

const DRAFT_VERSION = 1;

export async function saveDraft(userId: string, input: LancamentoInput) {
  const draft: StoredDraft = { version: DRAFT_VERSION, input };
  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramDraft: draft as unknown as Prisma.InputJsonValue,
      telegramDraftAt: new Date(),
    },
  });
}

// updateMany, not update: it runs after every ordinary turn (see
// runFiSyncAgent), and the `telegramDraftAt` filter makes it a no-op for
// the overwhelming majority of messages, which have no draft pending.
// `Prisma.DbNull` is the SQL NULL for a Json column — a bare `null` there
// means the JSON value `null`, which is not the same thing.
export async function clearDraft(userId: string) {
  await prisma.user.updateMany({
    where: { id: userId, NOT: { telegramDraftAt: null } },
    data: { telegramDraft: Prisma.DbNull, telegramDraftAt: null },
  });
}

// Read-and-clear: a draft is answered exactly once, and leaving it around
// after a "sim" is how a retried Telegram delivery would register the same
// lançamento twice.
export async function takeDraft(userId: string): Promise<LancamentoInput | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramDraft: true, telegramDraftAt: true },
  });

  const draft = user?.telegramDraft as unknown as StoredDraft | null | undefined;
  if (!draft || draft.version !== DRAFT_VERSION || !user?.telegramDraftAt) return null;

  await clearDraft(userId);

  const ageMinutes = (Date.now() - user.telegramDraftAt.getTime()) / 60_000;
  if (ageMinutes > DRAFT_TTL_MINUTES) return null;

  return draft.input;
}

// Only a message that is NOTHING but agreement counts — "sim" yes, "sim,
// mas no crédito" no. Punctuation and emoji are stripped first so "sim!!"
// and a bare thumbs-up land in the same place.
const AFFIRMATIVE = new Set([
  "sim", "s", "si", "isso", "isso mesmo", "isso ai", "ss",
  "pode", "pode sim", "pode ser", "pode registrar", "pode lancar", "pode mandar",
  "confirma", "confirmar", "confirmado", "confirmo",
  "ok", "okay", "oks", "blz", "beleza", "bora", "manda", "manda ver", "manda bala",
  "certo", "certeza", "exato", "exatamente", "perfeito", "positivo", "correto",
  "uhum", "aham", "ta", "ta bom", "ta certo", "tudo certo", "fechou", "show",
  "yes", "y", "vai", "registra", "lanca", "salva",
]);

const NEGATIVE = new Set([
  "nao", "n", "nops", "nem", "negativo",
  "cancela", "cancelar", "cancele", "esquece", "esquecer", "deixa",
  "deixa pra la", "agora nao", "melhor nao", "nao precisa", "para", "pare",
  "no", "nops nao",
]);

const AFFIRMATIVE_EMOJI = ["👍", "👌", "✅", "🆗", "☑️", "✔️"];

function normalizeAnswer(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\p{Extended_Pictographic}|️/gu, "")
    .replace(/[^\p{Letter}\s]/gu, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function isAffirmative(text: string): boolean {
  if (AFFIRMATIVE_EMOJI.some((emoji) => text.includes(emoji))) {
    // A thumbs-up on its own is a yes; a thumbs-up glued to a sentence is
    // that sentence, and the model should read it.
    return normalizeAnswer(text).length === 0;
  }
  return AFFIRMATIVE.has(normalizeAnswer(text));
}

export function isNegative(text: string): boolean {
  return NEGATIVE.has(normalizeAnswer(text));
}
