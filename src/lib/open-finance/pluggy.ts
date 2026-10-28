import { z } from "zod";
import { isPluggyConfigured } from "@/lib/open-finance/access";
import { checkedCursor } from "@/lib/open-finance/normalize";
import { OpenFinanceError, pluggyAccountSchema, pluggyItemSchema, pluggyTransactionSchema } from "@/lib/open-finance/schema";

const API = "https://api.pluggy.ai";

// Credentials and API keys stay in this server-side client. Fixed paths,
// no redirects and no-store prevent an upstream URL or cached response
// from leaking financial data or the key.
async function readJson(path: string, init: RequestInit) {
  try {
    const response = await fetch(`${API}${path}`, {
      ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new OpenFinanceError("provider");
    if (response.status === 204) return null;
    return await response.json();
  } catch {
    throw new OpenFinanceError("provider");
  }
}

export async function createPluggyClient() {
  if (!isPluggyConfigured()) throw new OpenFinanceError("configuration");
  const auth = z.object({ apiKey: z.string().min(1) }).safeParse(await readJson("/auth", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: process.env.PLUGGY_CLIENT_ID, clientSecret: process.env.PLUGGY_CLIENT_SECRET }),
  }));
  if (!auth.success) throw new OpenFinanceError("provider");
  const headers = { "X-API-KEY": auth.data.apiKey };
  async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const result = schema.safeParse(await readJson(path, { headers }));
    if (!result.success) throw new OpenFinanceError("provider");
    return result.data;
  }
  async function post<T>(path: string, body: unknown, schema: z.ZodType<T>, method: "POST" | "PATCH" = "POST"): Promise<T> {
    const result = schema.safeParse(await readJson(path, {
      method, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
    if (!result.success) throw new OpenFinanceError("provider");
    return result.data;
  }
  return {
    connectToken: (options: { clientUserId: string; avoidDuplicates: boolean; oauthRedirectUri?: string }) =>
      post("/connect_token", { options }, z.object({ accessToken: z.string().min(1).max(16000) })),
    ensureWebhooks: async (url: string, signature: string) => {
      const hookSchema = z.object({ id: z.uuid(), event: z.string(), url: z.string(), disabledAt: z.string().nullish(), headers: z.record(z.string(), z.string()).nullish() });
      const hooks = await get("/webhooks", z.object({ results: z.array(hookSchema) }).nullable().transform((value) => value ?? { results: [] }));
      for (const event of ["item/created", "item/updated"]) {
        const existing = hooks.results.find((hook) => hook.event === event && hook.url === url);
        if (existing && !existing.disabledAt && existing.headers?.["x-fi-sync-pluggy-signature"] === signature) continue;
        await post(existing ? `/webhooks/${existing.id}` : "/webhooks", { event, url, headers: { "x-fi-sync-pluggy-signature": signature }, ...(existing ? { enabled: true } : {}) }, z.object({ id: z.uuid() }), existing ? "PATCH" : "POST");
      }
    },
    item: (id: string) => get(`/items/${encodeURIComponent(id)}`, pluggyItemSchema),
    accounts: async (itemId: string) => {
      const data = await get(`/accounts?${new URLSearchParams({ itemId })}`, z.object({ results: z.array(pluggyAccountSchema) }));
      if (data.results.some((account) => account.itemId !== itemId)) throw new OpenFinanceError("provider");
      return data.results;
    },
    page: async (accountId: string, fromDate: string, cursor: string | null) => {
      const query = cursor ? checkedCursor(cursor, accountId, fromDate) : `?${new URLSearchParams({ accountId, dateFrom: fromDate })}`;
      const page = await get(`/v2/transactions${query}`, z.object({ results: z.array(pluggyTransactionSchema), next: z.string().nullable() }));
      if (page.results.some((row) => row.accountId !== accountId)) throw new OpenFinanceError("provider");
      if (page.next) checkedCursor(page.next, accountId, fromDate);
      return page;
    },
    transaction: async (accountId: string, id: string) => {
      const page = await get(`/v2/transactions?${new URLSearchParams({ accountId, ids: id })}`, z.object({ results: z.array(pluggyTransactionSchema) }));
      const row = page.results.find((entry) => entry.id === id && entry.accountId === accountId);
      if (!row) throw new OpenFinanceError("provider");
      return row;
    },
  };
}
