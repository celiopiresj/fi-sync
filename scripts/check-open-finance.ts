import assert from "node:assert/strict";
import { isOpenFinanceOwner } from "../src/lib/open-finance/access";
import { checkedCursor, isCardPayment, isNegativeAmount, normalizedAmount, transactionKey } from "../src/lib/open-finance/normalize";
import { createPluggyClient } from "../src/lib/open-finance/pluggy";
import { connectionSchema, mappingSchema, pluggyTransactionSchema, type PluggyTransaction } from "../src/lib/open-finance/schema";

const accountId = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000002";
const row: PluggyTransaction = { id, accountId, description: "fixture", amount: 19.99, currencyCode: "BRL", date: "2026-10-28T00:00:00.000Z", status: "POSTED" };

async function main() {
  const previousOwner = process.env.OPEN_FINANCE_USER_ID;
  const previousId = process.env.PLUGGY_CLIENT_ID;
  const previousSecret = process.env.PLUGGY_CLIENT_SECRET;
  const originalFetch = globalThis.fetch;
  try {
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
    let wrongAccount = false;
    const requests: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      requests.push(url.pathname);
      assert.equal(url.origin, "https://api.pluggy.ai");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "error");
      if (url.pathname === "/auth") return Response.json({ apiKey: "fixture-api-key" });
      assert.equal(new Headers(init?.headers).get("X-API-KEY"), "fixture-api-key");
      return Response.json({ results: [{ ...row, accountId: wrongAccount ? id : accountId }], next: null });
    };
    const client = await createPluggyClient();
    assert.equal((await client.page(accountId, "2026-10-01", null)).results[0].id, id);
    assert.equal((await client.transaction(accountId, id)).id, id);
    wrongAccount = true;
    await assert.rejects(client.page(accountId, "2026-10-01", null));
    await assert.rejects(client.transaction(accountId, id));
    assert.equal(requests.every((path) => path === "/auth" || path === "/v2/transactions"), true);
    console.log("Open Finance checks passed: owner isolation, money signs, dates, cursor boundaries and API account validation.");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of [["OPEN_FINANCE_USER_ID", previousOwner], ["PLUGGY_CLIENT_ID", previousId], ["PLUGGY_CLIENT_SECRET", previousSecret]]) {
      if (value === undefined) delete process.env[name!]; else process.env[name!] = value;
    }
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
