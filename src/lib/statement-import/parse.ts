import { groq } from "@ai-sdk/groq";
import {
  APICallError,
  generateObject,
  NoObjectGeneratedError,
  RetryError,
} from "ai";
import { extractText, getDocumentProxy } from "unpdf";
import {
  groqRateLimitRetryAfter,
  isGroqRateLimit,
} from "@/lib/ai/groq-rate-limit";
import { DEFAULT_AI_MODEL } from "@/lib/telegram/agent";
import {
  IMPORT_PDF_MEDIA_TYPE,
  statementExtractionSchema,
  type StatementEntry,
  type StatementSourceKind,
} from "./schema";

// A photo/print goes to a vision model instead of the text one the rest
// of the app uses — gpt-oss-120b has no image input at all. Overridable
// because Groq's vision catalog changes faster than this code does
// (check /openai/v1/models for what the account actually has).
//
// qwen3.8 and not its 3.6 sibling for a specific reason, measured
// against this account: 3.6 enforces a 1000 output-tokens-per-minute
// ceiling, which rejects this prompt outright (a statement needs
// thousands of output tokens to come back), while 3.8 accepts it. If you
// override this, check the model's OTPM limit before assuming a 429 is
// about how much you've been using it.
export const DEFAULT_AI_VISION_MODEL = "qwen/qwen3.8-27b";

// Groq does not charge the per-minute token budget for what a call
// actually uses — it RESERVES prompt + the whole completion allowance up
// front, before running anything (see the long note in
// telegram/agent.ts). Against this account's 8k TPM that makes both caps
// a single sum that has to fit: system prompt (~600 tokens) + document +
// output allowance < 8000, or the call is rejected before it starts.
//
// This was a real, verified failure, not a hypothetical: at the 20k
// chars / 6k output this started at, an ordinary fatura reserved ~9.6k
// and came back 429 ("tente de novo em 5s") every single time.
//
// So the output allowance is derived from the input instead of being a
// constant: whatever the document didn't spend is what's left to report
// it with. A flat cap can only be wrong in one of two directions — too
// high and a long statement is rejected before it runs, too low and a
// 35-line fatura runs out of room mid-JSON (which Groq reports as a 400
// `json_validate_failed`, see isTruncatedOutput below).
const MAX_TEXT_CHARS = 12_000;

// From this account's own response headers (x-ratelimit-limit-tokens).
// A different Groq tier has a different number, and getting it wrong is
// not silent — the 429 says exactly what was requested and what the
// limit is.
const TOKENS_PER_MINUTE_BUDGET = 8_000;
const BUDGET_MARGIN_TOKENS = 400;
// Rough for Portuguese through a BPE tokenizer, and deliberately on the
// low side: overestimating the prompt only leaves output room unused,
// while underestimating it gets the whole call rejected.
const CHARS_PER_TOKEN = 3.5;
// Floor and ceiling for that derived allowance. ~55–70 tokens per
// extracted line, so 1.5k still reports ~20 lines and 6k covers ~90.
const MIN_OUTPUT_TOKENS = 1_500;
const MAX_OUTPUT_TOKENS = 6_000;
// The image path can't measure its own prompt the same way (a photo's
// token cost depends on how the provider tiles it, not on any string
// this code holds), so it takes a fixed middle-of-the-road allowance.
const VISION_OUTPUT_TOKENS = 4_000;

// Same reasoning as the Telegram agent's own: the SDK's own retries fire
// after a couple of seconds regardless of what the provider asked for,
// and each attempt re-reserves the very budget it is waiting on. Retries
// here are off for that reason and replaced by the deliberate one below,
// which waits exactly as long as Groq said to.
const MAX_RETRIES = 0;

// A rate-limited read is retried ONCE, and only when Groq itself said
// how long to wait and that wait is short — the budget refills every
// minute, so the 5 seconds it usually asks for is the provider saying
// the request is fine and the account is momentarily out of room.
// Capped low on purpose: reading a big fatura already takes ~10s, and a
// Server Action that sleeps on top of that runs into the host's own
// function timeout. A longer wait goes back to the user as a message.
const MAX_AUTO_RETRY_WAIT_SECONDS = 10;

// The user message either carries the PDF's extracted text or the image
// itself — the AI SDK's own file part, not a hand-built data: URL.
type PromptContent = Array<
  | { type: "text"; text: string }
  | { type: "file"; mediaType: string; data: Uint8Array }
>;

export type StatementParseResult =
  | { status: "ok"; entries: StatementEntry[] }
  // A PDF with no extractable text layer — a scan, essentially. The
  // caller turns this into "envie uma foto" rather than a generic
  // failure, since a photo of that same page DOES work (vision path).
  | { status: "no-text" }
  | { status: "not-configured" }
  // The model ran out of output budget before closing the JSON — the
  // document had more lines than one call can report. Distinct from a
  // failure because the fix is the user's (send fewer lines, or the PDF
  // instead of a photo of it), not a retry.
  | { status: "truncated" }
  | { status: "rate-limited"; retryAfterSeconds: number | null };

// pdf.js reports a page's text as loose fragments, so a statement line
// arrives split across several of them. Nothing here tries to rebuild
// columns — the model is what reads the layout; this only keeps the
// blob small enough to be worth sending.
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).trim();
}

function buildInstructions(source: StatementSourceKind, today: string): string {
  const documentKind =
    source === "credit"
      ? "O documento é uma FATURA DE CARTÃO DE CRÉDITO: quase toda linha é uma compra (expense). Só estornos, créditos e devoluções são income."
      : "O documento é um EXTRATO DE CONTA BANCÁRIA: cada linha é uma entrada ou uma saída de dinheiro.";

  const ignored =
    source === "credit"
      ? "saldo anterior, limites, total da fatura, subtotais por cartão, encargos resumidos, pagamentos da própria fatura (\"PAGAMENTO RECEBIDO\", \"PGTO DEBITO AUTOMATICO\"), cabeçalhos, avisos e propaganda"
      : "saldo anterior, saldo do dia, saldo final, saldo bloqueado, totais e subtotais, cabeçalhos, avisos e propaganda";

  return [
    "Você extrai lançamentos de faturas de cartão e extratos bancários brasileiros.",
    documentKind,
    "",
    "Devolva um item por linha de lançamento real do documento, seguindo estas regras:",
    "- description: o nome do estabelecimento ou do lançamento, limpo — sem código de autorização, sem o número da parcela e sem a cidade/UF colada no fim. No máximo 60 caracteres.",
    "- amount: sempre positivo, convertido do formato brasileiro (1.234,56 vira 1234.56).",
    "- kind: \"expense\" para dinheiro que sai (compras, saques, débitos, pagamentos feitos) e \"income\" para dinheiro que entra (depósitos, Pix recebido, salário, estornos, créditos).",
    `- date: sempre no formato YYYY-MM-DD. Quando a linha só trouxer dia e mês, use o ano do próprio documento; na dúvida, o ano mais recente que não deixe a data no futuro em relação a ${today}.`,
    "- installmentNumber e installmentTotal: preencha quando a linha indicar parcelamento (\"PARC 03/10\", \"3/10\", \"PARCELA 3 DE 10\"). Se a linha não for parcelada, use null nos dois. A data continua sendo a que aparece na linha.",
    source === "debit"
      ? "- paymentMethod: PIX, DEBIT_CARD, BANK_TRANSFER (TED/DOC/transferência), BOLETO, CASH (saque/depósito em dinheiro) ou OTHER quando a linha indicar como o dinheiro se moveu. Use null se não der para saber."
      : "- paymentMethod: sempre null (é tudo cartão de crédito).",
    `- Ignore o que não é lançamento: ${ignored}.`,
    "- Se a mesma compra aparecer resumida e detalhada, devolva ela uma única vez.",
    "- Não invente nada: só o que está escrito no documento. Se não houver nenhum lançamento, devolva a lista vazia.",
  ].join("\n");
}

// Reads one attached file into the entries the review screen pre-fills
// its rows from. Both branches end at the same `generateObject` call —
// what changes is whether the document reaches the model as extracted
// text (PDF) or as an image (photo/print).
export async function parseStatement(params: {
  bytes: Uint8Array;
  mediaType: string;
  source: StatementSourceKind;
  today: string;
}): Promise<StatementParseResult> {
  if (!process.env.GROQ_API_KEY) return { status: "not-configured" };

  const isPdf = params.mediaType === IMPORT_PDF_MEDIA_TYPE;
  const instructions = buildInstructions(params.source, params.today);

  let modelId: string;
  let content: PromptContent;
  let maxOutputTokens: number;

  if (isPdf) {
    const text = await extractPdfText(params.bytes);
    // Under ~40 characters there is no statement in there to read —
    // it's a scanned page whose only text layer is a stray watermark.
    if (text.length < 40) return { status: "no-text" };
    modelId = process.env.AI_MODEL || DEFAULT_AI_MODEL;
    const documentText = text.slice(0, MAX_TEXT_CHARS);
    content = [
      { type: "text", text: `Texto extraído do documento:\n\n${documentText}` },
    ];
    maxOutputTokens = outputAllowanceFor(
      instructions.length + documentText.length,
    );
  } else {
    modelId = process.env.AI_VISION_MODEL || DEFAULT_AI_VISION_MODEL;
    content = [
      { type: "text", text: "Leia os lançamentos desta imagem." },
      { type: "file", mediaType: params.mediaType, data: params.bytes },
    ];
    maxOutputTokens = VISION_OUTPUT_TOKENS;
  }

  // Copied into a const because control-flow analysis doesn't follow a
  // `let` into a callback — the closure below would read it as possibly
  // unassigned.
  const outputTokens = maxOutputTokens;
  const attempt = () =>
    readEntries({
      modelId,
      content,
      system: instructions,
      maxOutputTokens: outputTokens,
    });

  const first = await attempt();
  if (
    first.status === "rate-limited" &&
    first.retryAfterSeconds !== null &&
    first.retryAfterSeconds <= MAX_AUTO_RETRY_WAIT_SECONDS
  ) {
    // One extra second past what Groq asked for: the budget resets on
    // its own clock, and coming back a shade early just spends the
    // attempt on the same 429.
    await sleep((first.retryAfterSeconds + 1) * 1000);
    return attempt();
  }

  return first;
}

// What's left of the per-minute budget once this prompt is paid for.
// Groq reserves prompt + allowance up front, so this is the number that
// decides whether the call runs at all.
function outputAllowanceFor(promptChars: number): number {
  const promptTokens = Math.ceil(promptChars / CHARS_PER_TOKEN);
  const available =
    TOKENS_PER_MINUTE_BUDGET - BUDGET_MARGIN_TOKENS - promptTokens;
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(MIN_OUTPUT_TOKENS, available));
}

// "The document had more lines than the allowance could report" arrives
// in two different shapes, and neither is an exception this code should
// let through as a crash:
//
//  - the SDK's own, when it got text back and couldn't parse an object
//    out of it (finishReason "length" — the model was cut off);
//  - Groq's, when the model was cut off inside its structured-output
//    mode: a 400 `json_validate_failed` whose `failed_generation` comes
//    back empty. Verified against a 35-line fatura at a 2.5k allowance.
//
// The second shape can in principle also mean the model produced invalid
// JSON for some other reason, but with a schema this simple, running out
// of room is what actually causes it — and "envie menos linhas" is a
// better answer for a garbled generation than "não deu, tente de novo".
function isTruncatedOutput(error: unknown): boolean {
  if (
    NoObjectGeneratedError.isInstance(error) &&
    error.finishReason === "length"
  ) {
    return true;
  }
  const apiError = RetryError.isInstance(error) ? error.lastError : error;
  return (
    APICallError.isInstance(apiError) &&
    apiError.statusCode === 400 &&
    typeof apiError.responseBody === "string" &&
    apiError.responseBody.includes("json_validate_failed")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One call to the model. Split out of parseStatement so the rate-limit
// retry above re-runs exactly this and nothing else — re-extracting the
// PDF or re-deciding the model would be pure waste on the second try.
async function readEntries(params: {
  modelId: string;
  system: string;
  content: PromptContent;
  maxOutputTokens: number;
}): Promise<StatementParseResult> {
  try {
    const result = await generateObject({
      model: groq(params.modelId),
      schema: statementExtractionSchema,
      system: params.system,
      messages: [{ role: "user", content: params.content }],
      maxRetries: MAX_RETRIES,
      maxOutputTokens: params.maxOutputTokens,
    });

    return { status: "ok", entries: result.object.entries.filter(isUsableEntry) };
  } catch (error) {
    if (isGroqRateLimit(error)) {
      return {
        status: "rate-limited",
        retryAfterSeconds: groqRateLimitRetryAfter(error),
      };
    }
    if (isTruncatedOutput(error)) return { status: "truncated" };
    throw error;
  }
}

// The schema can only say "a number" and "a string" — these are the
// checks that keep a hallucinated or half-read line from arriving in the
// review screen as a row the user has to notice and delete. A dropped
// line is recoverable (the user adds it by hand); a silently wrong one
// is not.
function isUsableEntry(entry: StatementEntry): boolean {
  if (!entry.description.trim()) return false;
  if (!Number.isFinite(entry.amount) || entry.amount <= 0) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return false;
  return true;
}
