import { APICallError, RetryError } from "ai";

// The SDK surfaces a provider error directly when retries are disabled,
// but still wraps it in a RetryError whenever it did attempt more than
// once — both helpers below unwrap both shapes rather than depending on
// which one shows up.
//
// Shared by every Groq call in the app (the Telegram agent and the
// statement importer): the per-minute budgets are per account, so the
// second caller hits exactly the same 429 the first one was already
// written against — a second hand-written copy of this unwrapping is how
// the two drift apart on which error shape they recognize.
function unwrap(error: unknown): unknown {
  return RetryError.isInstance(error) ? error.lastError : error;
}

// True for any 429 from Groq — an exhausted per-minute budget, whether
// that's input tokens, output tokens or requests. Separate from
// `groqRateLimitRetryAfter` below because Groq does NOT always say how
// long to wait: an output-tokens-per-minute rejection (measured against
// this account: "Request too large ... on output tokens per minute
// (OTPM): Limit 1000") comes back with the x-ratelimit-* headers and no
// `retry-after` at all. Deciding "is this a rate limit" from that header
// alone would report that one to the user as an unknown failure.
export function isGroqRateLimit(error: unknown): boolean {
  const apiError = unwrap(error);
  return APICallError.isInstance(apiError) && apiError.statusCode === 429;
}

// How long to wait, when Groq does say: an exhausted input-token budget
// answers 429 plus a `retry-after` header in whole seconds. Returns null
// both for what isn't a rate limit at all — so a genuine bug still
// propagates instead of being reported as "tente de novo em alguns
// segundos" — and for a rate limit that carried no such header.
export function groqRateLimitRetryAfter(error: unknown): number | null {
  const apiError = unwrap(error);

  if (!APICallError.isInstance(apiError) || apiError.statusCode !== 429) {
    return null;
  }

  const header = apiError.responseHeaders?.["retry-after"];
  const seconds = header ? Number.parseInt(header, 10) : Number.NaN;
  return Number.isFinite(seconds) ? seconds : null;
}
