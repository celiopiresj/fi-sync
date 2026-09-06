import { groq } from "@ai-sdk/groq";
import { generateText, hasToolCall, stepCountIs } from "ai";
import { groqRateLimitRetryAfter } from "@/lib/ai/groq-rate-limit";
import { clearDraft } from "./draft";
import { appendTurn, loadHistory } from "./history";
import { buildFiSyncInstructions } from "./persona";
import { createFiSyncTools } from "./tools";

export const DEFAULT_AI_MODEL = "openai/gpt-oss-120b";

// A read usually costs one tool call. A lançamento costs one too now:
// createTransaction takes names instead of ids, so the listAccounts +
// listCategories (+ listPeople) round-trip that used to precede every
// write is gone, and the turn ENDS on that call (see `stopWhen` below).
// What's left of the ceiling is for the awkward turns — a cadastro before
// the lançamento, a name that came back ambiguous — after which the model
// has to answer with what it already has, so a confused loop can't burn
// the whole webhook timeout.
const MAX_STEPS = 6;

// Retries are OFF, deliberately — the opposite of the usual advice. The
// one error this integration actually hits is Groq's per-minute TOKEN
// budget (TPM), and every step of a tool-calling turn resends the whole
// prompt (instructions + all tool schemas + history), so one attempt is
// already several thousand tokens. Retrying a 429 therefore spends the
// very budget it is waiting on: the SDK's default of two retries turned
// one over-budget call into three, pushing the reset further out each
// time and still failing. Failing on the first attempt and telling the
// user exactly how long to wait (Groq sends it in `retry-after`) is
// strictly better here.
const MAX_RETRIES = 0;

// Groq does not charge the TPM budget for what a call actually used — it
// RESERVES prompt + the completion allowance up front, before running
// anything, and that reservation is the "Requested" number in a 429.
// Without this cap the AI SDK sends `max_tokens: undefined` and Groq
// reserves a large default: measured against this account, a two-token
// "oi" cost ~1374 tokens of budget with no cap and ~28 with
// `max_tokens: 1`. That reservation, multiplied by every step of a
// tool-calling turn, is most of what was blowing the 8k/minute budget —
// not the tokens the bot was really using.
//
// 300 is sized for what this bot actually writes: Telegram replies are a
// few lines, and gpt-oss spends part of this on reasoning tokens (62 for
// a tool-call turn, measured). A long answer that hits the ceiling gets
// truncated rather than rejected, which is the better failure of the two.
const MAX_OUTPUT_TOKENS = 300;

export type FiSyncAgentResult =
  | { status: "ok"; text: string }
  | { status: "rate-limited"; retryAfterSeconds: number | null };

export async function runFiSyncAgent(params: {
  userId: string;
  text: string;
}): Promise<FiSyncAgentResult> {
  const history = await loadHistory(params.userId);

  let text: string;
  let lancamento: Record<string, unknown> | null;
  try {
    const result = await generateText({
      model: groq(process.env.AI_MODEL || DEFAULT_AI_MODEL),
      instructions: buildFiSyncInstructions(),
      messages: [...history, { role: "user", content: params.text }],
      tools: createFiSyncTools(params.userId),
      // The turn is over the moment a lançamento is worked out: the tool
      // already returns the finished pt-BR text (summary.ts), so letting
      // the model run one more step to rewrite it would cost a whole
      // extra call — the most expensive one of the turn, since it carries
      // every earlier tool result — to produce something worse.
      stopWhen: [stepCountIs(MAX_STEPS), hasToolCall("createTransaction")],
      maxRetries: MAX_RETRIES,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      providerOptions: {
        groq: { reasoningEffort: "low" },
      },
    });
    text = result.text;
    // Only the create tool's own output matters here — a read tool's
    // `error` ("qual conta?") is something the model still gets a step to
    // work with, not the end of the turn.
    lancamento =
      result.steps
        .flatMap((step) => step.toolResults)
        .filter((toolResult) => toolResult.toolName === "createTransaction")
        .map((toolResult) => toolResult.output as Record<string, unknown>)
        .at(-1) ?? null;
  } catch (error) {
    const retryAfterSeconds = groqRateLimitRetryAfter(error);
    if (retryAfterSeconds === null) throw error;
    // Nothing is appended to the history: the turn never produced an
    // answer, and persisting half a turn would leave the next message
    // replaying a question the bot never actually asked.
    return { status: "rate-limited", retryAfterSeconds };
  }

  // A turn that ended on a tool call with nothing left to say still has
  // to produce SOMETHING — Telegram rejects an empty sendMessage, and
  // silence reads as the bot having ignored the message.
  const reply =
    readyReply(lancamento) ||
    text.trim() ||
    "Não consegui montar uma resposta pra isso. Pode reformular?";

  // A pending confirmation only survives while it is the thing being
  // answered. Any other turn — a question, a correction, a second
  // lançamento — makes the old draft stale, and leaving it parked is what
  // would let a much later "pode sim" register something the user had
  // long moved on from.
  if (lancamento?.needsConfirmation !== true) {
    await clearDraft(params.userId);
  }

  await appendTurn(params.userId, params.text, reply);

  return { status: "ok", text: reply };
}

// The create tool answers in finished Portuguese: `reply` for a summary
// or a confirmed write, `error` for anything it refused (an unknown
// account name, a split that doesn't add up). Both are written to be read
// by the user, which is what makes ending the turn on that tool call safe
// — there is no step left in which the model could have phrased it.
function readyReply(output: Record<string, unknown> | null): string | null {
  if (typeof output?.reply === "string") return output.reply;
  if (typeof output?.error === "string") return output.error;
  return null;
}
