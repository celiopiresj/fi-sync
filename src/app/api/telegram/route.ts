import { NextResponse } from "next/server";
import { runFiSyncAgent } from "@/lib/telegram/agent";
import { isValidWebhookSecret, sendTelegramMessage, sendTypingAction } from "@/lib/telegram/api";
import { clearDraft, isAffirmative, isNegative, takeDraft } from "@/lib/telegram/draft";
import { appendTurn, clearHistory } from "@/lib/telegram/history";
import { findUserIdByChatId, redeemLinkCode, unlinkChat } from "@/lib/telegram/link";
import { TELEGRAM_REPLIES } from "@/lib/telegram/persona";
import { lancamentoInputSchema, runCreateLancamento } from "@/lib/telegram/tools";

// Telegram bot webhook. Register it once with:
//   curl -F "url=https://<host>/api/telegram" \
//        -F "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
//        https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook
//
// Not an `/api/[locale]` route and not covered by src/proxy.ts (its
// matcher excludes /api) — there's no session cookie and no locale here.
// Whose data a message touches comes from the chat->user link instead
// (src/lib/telegram/link.ts), and the reply is always pt-BR.
//
// Node runtime, not Edge: Prisma's Neon adapter needs `ws`, and the AI
// SDK tool loop can run for several seconds.
export const runtime = "nodejs";

// The model may make several tool calls before it answers; the default
// serverless budget is tighter than that turn can be.
export const maxDuration = 60;

export async function POST(request: Request) {
  // Rejected BEFORE the body is read: this route reads and writes real
  // financial data now, and the shared secret is the only thing proving
  // an update actually came from Telegram.
  if (!isValidWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let chatId: string | undefined;

  try {
    const update = await request.json();
    const message = update?.message ?? update?.edited_message;
    if (!message?.chat?.id) {
      return NextResponse.json({ status: "ignored" });
    }

    chatId = String(message.chat.id);
    const text: string | undefined = message.text;

    // Photos, voice notes, stickers — acknowledged rather than silently
    // dropped, so the user knows the bot got it and can't read it.
    if (typeof text !== "string" || text.trim().length === 0) {
      await sendTelegramMessage(chatId, TELEGRAM_REPLIES.unsupportedMessage);
      return NextResponse.json({ status: "ok" });
    }

    await sendTelegramMessage(chatId, await resolveReply(chatId, text.trim()));
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Erro no webhook do Telegram:", error);
    // Telegram retries a non-2xx delivery, which for a half-finished
    // lançamento would mean creating it twice — so the user gets told
    // something broke and the update is acknowledged either way.
    if (chatId) {
      await sendTelegramMessage(chatId, TELEGRAM_REPLIES.failure).catch(() => {});
    }
    return NextResponse.json({ status: "error" });
  }
}

// Commands are handled here, before the model ever sees the message —
// linking in particular must never depend on an LLM getting it right.
async function resolveReply(chatId: string, text: string): Promise<string> {
  const command = text.startsWith("/") ? text.slice(1).split(/[\s@]/)[0].toLowerCase() : null;
  const argument = text.slice(text.indexOf(" ") + 1).trim();

  if (command === "vincular") {
    const code = argument === text ? "" : argument;
    if (!code) return TELEGRAM_REPLIES.linkCodeMissing;

    const result = await redeemLinkCode(chatId, code);
    switch (result.status) {
      case "linked":
        return TELEGRAM_REPLIES.linked;
      case "rebound":
        return TELEGRAM_REPLIES.rebound;
      case "expired":
        return TELEGRAM_REPLIES.linkCodeExpired;
      default:
        return TELEGRAM_REPLIES.linkCodeInvalid;
    }
  }

  if (command === "desvincular") {
    const removed = await unlinkChat(chatId);
    return removed ? TELEGRAM_REPLIES.unlinked : TELEGRAM_REPLIES.notLinked;
  }

  const userId = await findUserIdByChatId(chatId);

  // Everything past this point needs to know whose money it is.
  if (!userId) return TELEGRAM_REPLIES.linkInstructions;

  // "start" and "help" are the two English aliases Telegram or muscle
  // memory produce; the Portuguese names are the real ones and the only
  // ones in the "/" menu (see src/lib/telegram/commands.ts).
  if (command === "iniciar" || command === "start") return TELEGRAM_REPLIES.alreadyLinked;
  if (command === "ajuda" || command === "help") return TELEGRAM_REPLIES.help;
  if (command === "limpar") {
    await Promise.all([clearHistory(userId), clearDraft(userId)]);
    return TELEGRAM_REPLIES.historyCleared;
  }

  // Answering a pending confirmation never reaches the model: the
  // lançamento was fully resolved on the turn that asked, and replaying it
  // here is a database write instead of the several thousand prompt tokens
  // a second agent turn costs (see src/lib/telegram/draft.ts).
  const answered = await answerPendingDraft(userId, text);
  if (answered) return answered;

  await sendTypingAction(chatId);

  const result = await runFiSyncAgent({ userId, text });
  return result.status === "ok"
    ? result.text
    : TELEGRAM_REPLIES.rateLimited(result.retryAfterSeconds);
}

// A message that is nothing but "sim" or "não" while a draft is pending,
// and nothing else. Anything with more in it than agreement ("sim, mas põe
// 45") is not an answer to replay — it's a new turn for the model — so it
// falls through, and so does a yes/no with no draft behind it.
async function answerPendingDraft(userId: string, text: string): Promise<string | null> {
  const affirmative = isAffirmative(text);
  if (!affirmative && !isNegative(text)) return null;

  // Read-and-clear: whatever happens below, this draft is spent.
  const draft = await takeDraft(userId);
  if (!draft) return null;

  const reply = affirmative ? await writeDraft(userId, draft) : TELEGRAM_REPLIES.draftCancelled;

  // The model never ran, but the turn still happened — without this the
  // next message would come back to a history where the bot asked
  // "posso registrar?" and nobody ever answered.
  await appendTurn(userId, text, reply);
  return reply;
}

async function writeDraft(userId: string, draft: unknown): Promise<string> {
  // Re-validated rather than trusted: the draft may have been written by
  // an older deploy whose schema had different fields, and a stored shape
  // is external input to the code reading it back.
  const parsed = lancamentoInputSchema.safeParse({
    ...(draft as Record<string, unknown>),
    confirmed: true,
  });
  if (!parsed.success) return TELEGRAM_REPLIES.draftFailed;

  const result = await runCreateLancamento(userId, parsed.data);
  if ("reply" in result && typeof result.reply === "string") return result.reply;
  if ("error" in result && typeof result.error === "string") return result.error;
  return TELEGRAM_REPLIES.draftFailed;
}
