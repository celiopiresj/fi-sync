import assert from "node:assert/strict";
import { isOpenFinanceOwner } from "../src/lib/open-finance/access";
import { checkedCursor, isCardPayment, isNegativeAmount, normalizedAmount, transactionKey } from "../src/lib/open-finance/normalize";
import { createPluggyClient } from "../src/lib/open-finance/pluggy";
import { connectionSchema, mappingSchema, pluggyTransactionSchema, processSchema, reviewEditsSchema, type PluggyTransaction } from "../src/lib/open-finance/schema";
import { NO_CATEGORY, reviewedTransaction } from "../src/lib/open-finance/review";
import { dateOnlyKey } from "../src/lib/date";
import { matchesDirection, selectedPreviewTotal } from "../src/app/[locale]/(app)/open-finance/_lib/preview-money";
import { groupSources } from "../src/app/[locale]/(app)/open-finance/_lib/options";
import { assertOwnedWidgetItem, pluggyWebhookSecret, publicAppOrigin, validPluggyWebhook, WEBHOOK_HEADER } from "../src/lib/open-finance/widget";
import { makeErrorMap } from "../src/lib/zod/zod-error-map";
import { failureFromWidgetEvent, widgetFailure } from "../src/app/[locale]/(app)/open-finance/_lib/widget-errors";

const accountId = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000002";
const row: PluggyTransaction = { id, accountId, description: "fixture", amount: 19.99, currencyCode: "BRL", date: "2026-10-28T00:00:00.000Z", status: "POSTED" };

async function main() {
  const previousOwner = process.env.OPEN_FINANCE_USER_ID;
  const previousId = process.env.PLUGGY_CLIENT_ID;
  const previousSecret = process.env.PLUGGY_CLIENT_SECRET;
  const originalFetch = globalThis.fetch;
  const previousOrigin = process.env.OPEN_FINANCE_APP_URL;
  const previousVercelEnv = process.env.VERCEL_ENV;
  const previousVercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  try {
    const previewFixture = { id, date: "2026-10-28", description: "fixture", amount: "-19.99", status: "POSTED" as const, payment: false };
    assert.equal(matchesDirection(previewFixture, "expense"), true);
    assert.equal(matchesDirection(previewFixture, "income"), false);
    assert.equal(matchesDirection({ ...previewFixture, amount: null }, "income"), false);
    assert.equal(selectedPreviewTotal([previewFixture, { ...previewFixture, amount: "0.10" }, { ...previewFixture, amount: "0.20" }]), "-19.69");
    assert.equal(selectedPreviewTotal([]), "0.00");
    const grouped = groupSources([
      { id: "bank", name: "VISA in bank label", type: "BANK", currency: "BRL", accountId: null, cardId: null, fromDate: null, hasImports: false, bankLabel: "fixture", connectionId: "connection" },
      { id: "card", name: "Account in card label", type: "CREDIT", currency: "BRL", accountId: null, cardId: null, fromDate: null, hasImports: false, bankLabel: "fixture", connectionId: "connection" },
    ]);
    assert.deepEqual(grouped[0].sources.map((source) => source.id), ["bank"]);
    assert.deepEqual(grouped[1].sources.map((source) => source.id), ["card"]);
    const edits = { description: "  Edited locally  ", date: "2026-11-01", amount: "25,10", type: "expense" as const, categoryId: NO_CATEGORY };
    const reviewed = reviewedTransaction(reviewEditsSchema.parse(edits));
    assert.equal(reviewed.amount, "-25.10");
    assert.equal(reviewed.description, "Edited locally");
    assert.equal(dateOnlyKey(reviewed.date), "2026-11-01");
    assert.equal(reviewed.categoryId, null);
    assert.equal(reviewedTransaction({ ...edits, amount: "0.10", type: "income" }).amount, "0.10");
    assert.equal(reviewedTransaction({ ...edits, amount: "9999999999.99" }).amount, "-9999999999.99");
    assert.equal(reviewedTransaction({ ...edits, amount: "1.1" }).amount, "-1.10");
    for (const invalid of ["", "0", "0,00", "-1.00", "1.005", "10000000000.00", "1e2", "NaN", "1,000.00"]) {
      assert.equal(reviewEditsSchema.safeParse({ ...edits, amount: invalid }).success, false);
    }
    assert.equal(reviewEditsSchema.safeParse({ ...edits, description: "  " }).success, false);
    assert.equal(reviewEditsSchema.safeParse({ ...edits, date: "2026-02-30" }).success, false);
    const original = { sourceId: "source", transactionId: id, existingTransactionId: "", closingDate: "", dueDate: "", expectedAmount: "-19.99", expectedDate: "2026-10-28", expectedDescription: "bank original" };
    assert.equal(processSchema.safeParse({ ...original, mode: "create" }).success, false);
    const request = processSchema.parse({ ...original, mode: "create", edits });
    assert.equal(request.expectedAmount, "-19.99");
    assert.equal(request.expectedDescription, "bank original");
    assert.equal(processSchema.safeParse({ ...original, mode: "ignore" }).success, true);
    assert.equal(processSchema.safeParse({ ...original, mode: "match", existingTransactionId: "existing" }).success, true);
    const duplicateFailure = widgetFailure({ message: "Connection failed", data: { codeDescription: "ITEM_USER_ALREADY_EXISTS" } });
    assert.equal(duplicateFailure.reason, "widgetDuplicate");
    assert.equal(duplicateFailure.keepOpen, true);
    assert.equal(widgetFailure({ data: { item: { error: { code: "INVALID_CREDENTIALS" } } } }).reason, "widgetCredentials");
    assert.equal(widgetFailure({ response: { data: { codeDescription: "CONNECTOR_NOT_SUPPORTED" } } }).reason, "widgetConnector");
    assert.equal(widgetFailure({ code: 401 }).reason, "widgetToken");
    assert.equal(widgetFailure(undefined).keepOpen, true);
    assert.equal(widgetFailure(new Error("load failure"), "load").keepOpen, false);
    const privateFailure = widgetFailure({ message: "secret-password https://example.com/?token=secret-token", code: "eyJhbGci.payload.signature" });
    assert.equal(privateFailure.code, null);
    assert.equal(JSON.stringify(privateFailure).includes("secret"), false);
    assert.equal(failureFromWidgetEvent({ event: "ITEM_RESPONSE", item: { error: { code: "USER_AUTHORIZATION_PENDING" } } })?.reason, "widgetAuthorization");
    assert.equal(failureFromWidgetEvent({ event: "ITEM_RESPONSE", item: { error: null } }), null);
    assert.equal(failureFromWidgetEvent({ event: "LOGIN_SUCCESS", item: {} }), null);
    delete process.env.OPEN_FINANCE_USER_ID;
    assert.equal(isOpenFinanceOwner("owner"), false);
    process.env.OPEN_FINANCE_USER_ID = "owner";
    assert.equal(isOpenFinanceOwner(null), false);
    assert.equal(isOpenFinanceOwner("other"), false);
    assert.equal(isOpenFinanceOwner("owner"), true);
    assert.equal(normalizedAmount(row, "BANK"), "19.99");
    assert.equal(normalizedAmount(row, "CREDIT"), "-19.99");
    assert.equal(isNegativeAmount("-19.99"), true);
    assert.equal(isNegativeAmount("19.99"), false);
    assert.equal(normalizedAmount({ ...row, amount: -19.99 }, "CREDIT"), "19.99");
    assert.equal(normalizedAmount({ ...row, amount: 0.1 }, "CREDIT"), "-0.10");
    assert.equal(normalizedAmount({ ...row, amount: 9999999999.99 }, "CREDIT"), "-9999999999.99");
    assert.throws(() => normalizedAmount({ ...row, currencyCode: "USD" }, "BANK"));
    assert.equal(normalizedAmount({ ...row, currencyCode: "USD", amountInAccountCurrency: 100.01 }, "CREDIT"), "-100.01");
    assert.equal(transactionKey({ ...row, providerId: "stable-bank-id" }), "bank:stable-bank-id");
    assert.equal(transactionKey(row), `pluggy:${id}`);
    assert.equal(isCardPayment({ ...row, operationType: "PAGAMENTO_FATURA" }, "CREDIT"), true);
    assert.equal(isCardPayment({ ...row, operationType: "ESTORNO" }, "CREDIT"), false);
    assert.equal(pluggyTransactionSchema.safeParse({ ...row, date: "2026-02-30" }).success, false);
    assert.equal(pluggyTransactionSchema.safeParse({ ...row, date: "2026-10-28Tinvalid" }).success, false);
    assert.equal(pluggyTransactionSchema.safeParse({ ...row, amount: 1.005 }).success, false);
    assert.equal(connectionSchema.safeParse({ label: "bank", itemId: "../auth" }).success, false);
    assert.equal(mappingSchema.safeParse({ sourceId: "a", accountId: "b", cardId: "", fromDate: "2026-02-30" }).success, false);
    const cursor = `?accountId=${accountId}&dateFrom=2026-10-01&after=opaque%2Bvalue%3D`;
    assert.equal(checkedCursor(cursor, accountId, "2026-10-01"), cursor);
    for (const invalid of ["https://evil.example/", "//evil.example/", `${cursor}&ids=${id}`, `${cursor}&accountId=${id}`, cursor.replace(accountId, id), cursor.replace("2026-10-01", "2020-01-01")]) {
      assert.throws(() => checkedCursor(invalid, accountId, "2026-10-01"));
    }
    process.env.PLUGGY_CLIENT_ID = "fixture-client";
    process.env.PLUGGY_CLIENT_SECRET = "fixture-secret";
    assertOwnedWidgetItem({ id, status: "UPDATED", clientUserId: "owner", connector: { id: 200, name: "MeuPluggy" } }, "owner");
    for (const item of [
      { id, status: "UPDATED", clientUserId: "other", connector: { id: 200, name: "MeuPluggy" } },
      { id, status: "UPDATED", clientUserId: "owner", connector: { id: 600, name: "Sandbox" } },
      { id, status: "UPDATED", connector: { id: 200, name: "MeuPluggy" } },
    ]) assert.throws(() => assertOwnedWidgetItem(item, "owner"));
    const signature = pluggyWebhookSecret()!;
    assert.equal(signature.includes("fixture-secret"), false);
    assert.equal(validPluggyWebhook(new Request("https://app.example.com", { headers: { [WEBHOOK_HEADER]: signature } })), true);
    for (const invalid of ["", "wrong", "é".repeat(64)]) assert.equal(validPluggyWebhook(new Request("https://app.example.com", { headers: { [WEBHOOK_HEADER]: invalid } })), false);
    process.env.OPEN_FINANCE_APP_URL = "https://app.example.com/some/path";
    assert.equal(publicAppOrigin(), "https://app.example.com");
    process.env.OPEN_FINANCE_APP_URL = "";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "app.example.com";
    assert.equal(publicAppOrigin(), "https://app.example.com");
    for (const origin of ["http://app.example.com", "https://localhost", "https://127.0.0.1", "https://test.internal"]) {
      process.env.OPEN_FINANCE_APP_URL = origin;
      assert.throws(publicAppOrigin);
    }
    const invalidUuid = connectionSchema.safeParse({ label: "bank", itemId: "invalid" }, { error: makeErrorMap((key) => `translated:${key}`) });
    assert.equal(invalidUuid.success, false);
    if (!invalidUuid.success) assert.equal(invalidUuid.error.issues[0].message, "translated:invalid");
    let wrongAccount = false;
    const webhooks: { id: string; event: string; url: string; headers: Record<string, string> }[] = [];
    const requests: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      requests.push(url.pathname);
      assert.equal(url.origin, "https://api.pluggy.ai");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "error");
      if (url.pathname === "/auth") return Response.json({ apiKey: "fixture-api-key" });
      assert.equal(new Headers(init?.headers).get("X-API-KEY"), "fixture-api-key");
      if (url.pathname === "/connect_token") {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.options.clientUserId, "owner");
        // Existing Dashboard authorizations must not prevent this widget
        // from starting its own owner-bound MeuPluggy authorization.
        assert.equal(body.options.avoidDuplicates, false);
        assert.equal(body.options.oauthRedirectUri, "https://app.example.com/pt-BR/open-finance");
        return Response.json({ accessToken: "fixture-connect-token" });
      }
      if (url.pathname === "/webhooks") {
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          const hookId = body.event === "item/created" ? id : accountId;
          webhooks.push({ id: hookId, ...body });
          return Response.json({ id: hookId });
        }
        return webhooks.length ? Response.json({ results: webhooks }) : new Response(null, { status: 204 });
      }
      if (url.pathname.startsWith("/webhooks/") && init?.method === "PATCH") {
        const hook = webhooks.find((entry) => entry.id === url.pathname.split("/").pop());
        assert.ok(hook);
        Object.assign(hook, JSON.parse(String(init.body)));
        return Response.json({ id: hook.id });
      }
      return Response.json({ results: [{ ...row, accountId: wrongAccount ? id : accountId }], next: null });
    };
    const client = await createPluggyClient();
    assert.deepEqual(await client.meuPluggyConnectToken({ clientUserId: "owner", oauthRedirectUri: "https://app.example.com/pt-BR/open-finance" }), { accessToken: "fixture-connect-token" });
    await client.ensureWebhooks("https://app.example.com/api/open-finance/pluggy", signature);
    await client.ensureWebhooks("https://app.example.com/api/open-finance/pluggy", signature);
    assert.equal(webhooks.length, 2);
    await client.ensureWebhooks("https://app.example.com/api/open-finance/pluggy", "rotated-fixture-signature");
    assert.equal(webhooks.length, 2);
    assert.equal(webhooks.every((hook) => hook.headers[WEBHOOK_HEADER] === "rotated-fixture-signature"), true);
    assert.equal((await client.page(accountId, "2026-10-01", null)).results[0].id, id);
    assert.equal((await client.transaction(accountId, id)).id, id);
    wrongAccount = true;
    await assert.rejects(client.page(accountId, "2026-10-01", null));
    await assert.rejects(client.transaction(accountId, id));
    assert.equal(requests.every((path) => ["/auth", "/v2/transactions", "/connect_token", "/webhooks"].includes(path) || path.startsWith("/webhooks/")), true);
    console.log("Open Finance checks passed: editable review, exact money/dates, required confirmation, original snapshots, widget lifecycle, owner isolation, callbacks, webhooks and pagination.");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousOrigin === undefined) delete process.env.OPEN_FINANCE_APP_URL; else process.env.OPEN_FINANCE_APP_URL = previousOrigin;
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previousVercelEnv;
    if (previousVercelProduction === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL; else process.env.VERCEL_PROJECT_PRODUCTION_URL = previousVercelProduction;
    for (const [name, value] of [["OPEN_FINANCE_USER_ID", previousOwner], ["PLUGGY_CLIENT_ID", previousId], ["PLUGGY_CLIENT_SECRET", previousSecret]]) {
      if (value === undefined) delete process.env[name!]; else process.env[name!] = value;
    }
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
