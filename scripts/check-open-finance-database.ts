import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { dateOnlyKey, parseCalendarDate } from "../src/lib/date";
import { savePluggyConnection } from "../src/lib/open-finance/connections";
import { POST as pluggyWebhook } from "../src/app/api/open-finance/pluggy/route";
import { pluggyWebhookSecret, WEBHOOK_HEADER } from "../src/lib/open-finance/widget";

// Every fixture is isolated from real users and the entire transaction
// is rolled back, including on success. No bank connection is contacted.
const rollback = new Error("rollback-open-finance-checks");
async function main() {
  const savedSecret = process.env.PLUGGY_CLIENT_SECRET;
  process.env.PLUGGY_CLIENT_SECRET = "fixture-secret";
  try {
    const signature = pluggyWebhookSecret();
    assert.ok(signature);
    assert.equal((await pluggyWebhook(new Request("https://app.example.com", { method: "POST", body: "{}" }))).status, 401);
    const headers = { [WEBHOOK_HEADER]: signature, "Content-Type": "application/json" };
    assert.equal((await pluggyWebhook(new Request("https://app.example.com", { method: "POST", headers, body: "invalid-json" }))).status, 400);
    assert.equal((await pluggyWebhook(new Request("https://app.example.com", { method: "POST", headers, body: JSON.stringify({ event: "item/created", itemId: "invalid" }) }))).status, 400);
    assert.equal((await pluggyWebhook(new Request("https://app.example.com", { method: "POST", headers, body: JSON.stringify({ event: "transactions/created" }) }))).status, 204);
  } finally {
    if (savedSecret === undefined) delete process.env.PLUGGY_CLIENT_SECRET; else process.env.PLUGGY_CLIENT_SECRET = savedSecret;
  }
  try {
    await prisma.$transaction(async (tx) => {
      const userId = `open-finance-check-${randomUUID()}`;
      await tx.user.create({ data: { id: userId } });
      const account = await tx.account.create({ data: { userId, name: "Open Finance fixture", type: "CHECKING" } });
      const connection = await tx.openFinanceConnection.create({ data: { userId, itemId: randomUUID(), label: "fixture" } });
      const source = await tx.openFinanceSource.create({ data: {
        connectionId: connection.id, externalAccountId: randomUUID(), name: "fixture", type: "BANK", currency: "BRL", accountId: account.id,
      } });
      const providerAccount = { id: source.externalAccountId, itemId: connection.itemId, name: "updated fixture", type: "BANK" as const, currencyCode: "BRL" };
      await savePluggyConnection(userId, connection.itemId, "automatic label", [providerAccount], true, tx);
      await savePluggyConnection(userId, connection.itemId, "automatic label", [providerAccount], true, tx);
      assert.equal(await tx.openFinanceSource.count({ where: { connectionId: connection.id } }), 1);
      assert.equal((await tx.openFinanceSource.findUnique({ where: { id: source.id } }))?.accountId, account.id);
      await tx.openFinanceConnection.update({ where: { id: connection.id }, data: { active: false } });
      await savePluggyConnection(userId, connection.itemId, "late callback", [providerAccount], false, tx);
      assert.equal((await tx.openFinanceConnection.findUnique({ where: { id: connection.id } }))?.active, false);
      await savePluggyConnection(userId, connection.itemId, "explicit reconnect", [providerAccount], true, tx);
      assert.equal((await tx.openFinanceConnection.findUnique({ where: { id: connection.id } }))?.active, true);
      await assert.rejects(savePluggyConnection("other-user", connection.itemId, "fixture", [providerAccount], true, tx));
      const date = parseCalendarDate("2026-10-28");
      const transaction = await tx.transaction.create({ data: { userId, accountId: account.id, description: "fixture", amount: "-19.99", date } });
      assert.equal(dateOnlyKey(transaction.date), "2026-10-28");
      assert.equal((await tx.transaction.findFirst({ where: { userId, accountId: account.id, amount: "-19.99", date } }))?.id, transaction.id);
      await tx.openFinanceImport.create({ data: { sourceId: source.id, externalKey: "bank:fixture", transactionId: transaction.id } });
      const duplicate = await tx.openFinanceImport.createMany({ data: [{ sourceId: source.id, externalKey: "bank:fixture" }], skipDuplicates: true });
      assert.equal(duplicate.count, 0);
      assert.equal(await tx.openFinanceSource.findFirst({ where: { id: source.id, connection: { userId: "different-user" } } }), null);
      await tx.transaction.delete({ where: { id: transaction.id } });
      const receipt = await tx.openFinanceImport.findUnique({ where: { sourceId_externalKey: { sourceId: source.id, externalKey: "bank:fixture" } } });
      assert.ok(receipt);
      assert.equal(receipt.transactionId, null);
      const retained = await tx.transaction.create({ data: { userId, accountId: account.id, description: "retained fixture", amount: "1.01", date } });
      await tx.openFinanceImport.create({ data: { sourceId: source.id, externalKey: "bank:retained", transactionId: retained.id } });
      await tx.openFinanceConnection.delete({ where: { id: connection.id } });
      assert.ok(await tx.transaction.findUnique({ where: { id: retained.id } }));
      throw rollback;
    }, { timeout: 30000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log("Database checks passed and rolled back: exact dates and amounts, owner filters, unique receipts and transaction retention.");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
