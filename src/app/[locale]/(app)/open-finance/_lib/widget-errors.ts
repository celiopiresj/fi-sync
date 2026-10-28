import { z } from "zod";
import type { WidgetFailure } from "../_types/types";

const errorDetails = z.object({
  code: z.union([z.string(), z.number()]).optional(), codeDescription: z.string().optional(),
  type: z.string().optional(),
}).passthrough();
const failureSchema = errorDetails.extend({
  message: z.string().optional(),
  data: errorDetails.extend({ item: z.object({ error: errorDetails.nullish() }).optional() }).optional(),
  response: z.object({ data: errorDetails.optional() }).optional(),
});
const knownCodes = ["ITEM_USER_ALREADY_EXISTS", "INVALID_CREDENTIALS", "USER_AUTHORIZATION_PENDING", "USER_AUTHORIZATION_EXPIRED", "CONNECTOR_NOT_FOUND", "CONNECTOR_NOT_SUPPORTED", "CONNECTOR_NOT_AVAILABLE", "INVALID_CONNECT_TOKEN", "INVALID_TOKEN", "TOKEN_EXPIRED", "UNAUTHORIZED"];

function safeCode(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599) return `HTTP_${value}`;
  // Display only short machine codes, never arbitrary SDK messages,
  // request URLs, credentials, tokens or user-supplied input.
  return typeof value === "string" && value.length <= 80 && /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(value) ? value : null;
}

export function widgetFailure(input: unknown, stage: "connection" | "load" = "connection"): WidgetFailure {
  if (stage === "load") return { reason: "widgetLoad", code: null, keepOpen: false };
  const parsed = failureSchema.safeParse(input);
  if (!parsed.success) return { reason: "widget", code: null, keepOpen: true };
  const error = parsed.data;
  const candidates = [error.data?.item?.error?.codeDescription, error.codeDescription,
    error.data?.codeDescription, error.response?.data?.codeDescription,
    error.data?.item?.error?.code, error.data?.item?.error?.type, error.code, error.data?.code];
  const code = candidates.map(safeCode).find(Boolean) ?? knownCodes.find((known) => error.message?.includes(known)) ?? null;
  let reason: WidgetFailure["reason"] = "widget";
  if (code === "ITEM_USER_ALREADY_EXISTS") reason = "widgetDuplicate";
  else if (code === "INVALID_CREDENTIALS") reason = "widgetCredentials";
  else if (code === "USER_AUTHORIZATION_PENDING") reason = "widgetAuthorization";
  else if (code && ["USER_AUTHORIZATION_EXPIRED", "INVALID_CONNECT_TOKEN", "INVALID_TOKEN", "TOKEN_EXPIRED", "UNAUTHORIZED", "HTTP_401"].includes(code)) reason = "widgetToken";
  else if (code?.startsWith("CONNECTOR_")) reason = "widgetConnector";
  return { reason, code, keepOpen: true };
}

export function failureFromWidgetEvent(input: unknown): WidgetFailure | null {
  const event = z.object({ event: z.literal("ITEM_RESPONSE"), item: z.object({ error: errorDetails.nullish() }) }).safeParse(input);
  return event.success && event.data.item.error ? widgetFailure({ data: { item: event.data.item } }) : null;
}
