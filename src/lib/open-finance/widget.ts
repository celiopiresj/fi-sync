import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { OpenFinanceError, pluggyItemSchema } from "@/lib/open-finance/schema";
import type { z } from "zod";

export const MEU_PLUGGY_CONNECTOR_ID = 200;
export const WEBHOOK_HEADER = "x-fi-sync-pluggy-signature";

export function publicAppOrigin(): string | null {
  const configured = process.env.OPEN_FINANCE_APP_URL?.trim() || undefined;
  const hostname = process.env.VERCEL_ENV === "production"
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
    : process.env.VERCEL_URL;
  if (!configured && !hostname) return null;
  try {
    const url = new URL(configured ?? `https://${hostname}`);
    if (url.protocol !== "https:" || url.username || url.password || isIP(url.hostname) ||
      /(^localhost$|\.(localhost|local|internal)$)/.test(url.hostname)) throw new Error();
    return url.origin;
  } catch { throw new OpenFinanceError("configuration"); }
}

export function pluggyWebhookSecret(): string | null {
  const userId = process.env.OPEN_FINANCE_USER_ID?.trim();
  const secret = process.env.PLUGGY_CLIENT_SECRET?.trim();
  return userId && secret ? createHmac("sha256", secret).update(`fi-sync:pluggy-webhook:${userId}`).digest("hex") : null;
}

export function validPluggyWebhook(request: Request): boolean {
  const expected = pluggyWebhookSecret();
  const supplied = request.headers.get(WEBHOOK_HEADER);
  return Boolean(expected && supplied && /^[a-f0-9]{64}$/.test(supplied) &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)));
}

export function assertOwnedWidgetItem(item: z.infer<typeof pluggyItemSchema>, ownerId: string): void {
  if (item.clientUserId !== ownerId || item.connector?.id !== MEU_PLUGGY_CONNECTOR_ID || item.connector.isSandbox) {
    throw new OpenFinanceError("access");
  }
}
