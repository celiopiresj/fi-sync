import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { dateOnlyKey, parseCalendarDate } from "../src/lib/date";
import { savePluggyConnection } from "../src/lib/open-finance/connections";
import { POST as pluggyWebhook } from "../src/app/api/open-finance/pluggy/route";
import { pluggyWebhookSecret, WEBHOOK_HEADER } from "../src/lib/open-finance/widget";
import { processReviewedTransaction } from "../src/lib/open-finance/process";
import { OpenFinanceError, type PluggyTransaction, type ProcessValues } from "../src/lib/open-finance/schema";

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
        connectionId: connection.id, externalAccountId: randomUUID(), name: "fixture", type: "BANK", currency: "BRL", accountId: account.id, importFromDate: parseCalendarDate("2026-10-01"),
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
      const category = await tx.category.create({ data: { userId, name: "Review fixture", type: "EXPENSE" } });
      const other = await tx.user.create({ data: { id: `${userId}-other` } });
      const privateCategory = await tx.category.create({ data: { userId: other.id, name: "Private fixture", type: "EXPENSE" } });
      const incomeCategory = await tx.category.create({ data: { userId, name: "Income fixture", type: "INCOME" } });
      const bankRow: PluggyTransaction = { id: randomUUID(), accountId: source.externalAccountId, providerId: "reviewed", description: "Bank original", date: "2026-10-28", amount: -19.99, currencyCode: "BRL", status: "POSTED" };
      const mapping = { accountId: account.id, cardId: null, fromDate: "2026-10-01" };
      const value: Extract<ProcessValues, { mode: "create" }> = {
        sourceId: source.id, transactionId: bankRow.id, mode: "create", existingTransactionId: "", closingDate: "", dueDate: "",
        expectedAmount: "-19.99", expectedDate: "2026-10-28", expectedDescription: "Bank original",
        edits: { description: "My edited purchase", date: "2026-10-30", amount: "25,10", type: "expense", categoryId: category.id },
      };
      const unchangedCount = await tx.transaction.count({ where: { userId } });
      await assert.rejects(processReviewedTransaction(tx, other.id, bankRow, mapping, value));
      await assert.rejects(processReviewedTransaction(tx, userId, { ...bankRow, description: "Bank changed it" }, mapping, value), (error) => error instanceof OpenFinanceError && error.code === "stale");
      for (const categoryId of [privateCategory.id, incomeCategory.id]) {
        await assert.rejects(processReviewedTransaction(tx, userId, bankRow, mapping, { ...value, edits: { ...value.edits, categoryId } }), (error) => error instanceof OpenFinanceError && error.code === "invalid");
      }
      await assert.rejects(processReviewedTransaction(tx, userId, { ...bankRow, status: "PENDING" }, mapping, value), (error) => error instanceof OpenFinanceError && error.code === "pending");
      assert.equal(await tx.transaction.count({ where: { userId } }), unchangedCount);
      assert.equal(await tx.openFinanceImport.count({ where: { sourceId: source.id, externalKey: "bank:reviewed" } }), 0);
      await processReviewedTransaction(tx, userId, bankRow, mapping, value);
      const saved = await tx.transaction.findFirstOrThrow({ where: { userId, description: "My edited purchase" } });
      assert.equal(saved.amount.toFixed(2), "-25.10");
      assert.equal(dateOnlyKey(saved.date), "2026-10-30");
      assert.equal(saved.categoryId, category.id);
      assert.equal(bankRow.description, "Bank original");
      const editedReceipt = await tx.openFinanceImport.findUniqueOrThrow({ where: { sourceId_externalKey: { sourceId: source.id, externalKey: "bank:reviewed" } } });
      assert.equal(editedReceipt.transactionId, saved.id);
      await processReviewedTransaction(tx, userId, bankRow, mapping, value);
      assert.equal(await tx.transaction.count({ where: { userId } }), unchangedCount + 1);
      const anotherRow = { ...bankRow, id: randomUUID(), providerId: "edited-duplicate" };
      await assert.rejects(processReviewedTransaction(tx, userId, anotherRow, mapping, { ...value, transactionId: anotherRow.id }), (error) => error instanceof OpenFinanceError && error.code === "duplicate");
      const originalDuplicate = { ...anotherRow, providerId: "original-duplicate", amount: -25.10, date: "2026-10-30" };
      await assert.rejects(processReviewedTransaction(tx, userId, originalDuplicate, mapping, {
        ...value, transactionId: originalDuplicate.id, expectedAmount: "-25.10", expectedDate: "2026-10-30", edits: { ...value.edits, amount: "30.00", date: "2026-10-31" },
      }), (error) => error instanceof OpenFinanceError && error.code === "duplicate");
      await processReviewedTransaction(tx, userId, anotherRow, mapping, { ...value, transactionId: anotherRow.id, mode: "ignore" });
      assert.equal(await tx.transaction.count({ where: { userId } }), unchangedCount + 1);
      assert.equal((await tx.openFinanceImport.findUniqueOrThrow({ where: { sourceId_externalKey: { sourceId: source.id, externalKey: "bank:edited-duplicate" } } })).transactionId, null);
      const creditAccount = await tx.account.create({ data: { userId, name: "Credit review fixture", type: "CREDIT_CARD", creditCardDetails: { create: { limit: "1000", closingDay: 10, dueDay: 20 } } } });
      const card = await tx.card.create({ data: { accountId: creditAccount.id, name: "Review card" } });
      const creditSource = await tx.openFinanceSource.create({ data: {
        connectionId: connection.id, externalAccountId: randomUUID(), name: "Credit fixture", type: "CREDIT", currency: "BRL", accountId: creditAccount.id, cardId: card.id, importFromDate: parseCalendarDate("2026-10-01"),
      } });
      const creditRow = { ...bankRow, id: randomUUID(), accountId: creditSource.externalAccountId, providerId: "reviewed-card", amount: 19.99 };
      const creditMapping = { accountId: creditAccount.id, cardId: card.id, fromDate: "2026-10-01" };
      const creditValue = { ...value, sourceId: creditSource.id, transactionId: creditRow.id, closingDate: "2026-10-30", dueDate: "2026-11-10", edits: { ...value.edits, date: "2026-11-05" } };
      await assert.rejects(processReviewedTransaction(tx, userId, creditRow, creditMapping, creditValue), (error) => error instanceof OpenFinanceError && error.code === "invoice");
      assert.equal(await tx.invoice.count({ where: { accountId: creditAccount.id } }), 0);
      await processReviewedTransaction(tx, userId, creditRow, creditMapping, { ...creditValue, closingDate: "2026-11-10", dueDate: "2026-11-20" });
      const cardTransaction = await tx.transaction.findFirstOrThrow({ where: { userId, accountId: creditAccount.id }, include: { transactionInvoice: { include: { invoice: true } }, transactionCard: true } });
      assert.equal(dateOnlyKey(cardTransaction.date), "2026-11-05");
      assert.equal(dateOnlyKey(cardTransaction.transactionInvoice!.invoice.closingDate), "2026-11-10");
      assert.equal(cardTransaction.transactionCard!.cardId, card.id);
      const cardPayment = { ...creditRow, id: randomUUID(), providerId: "card-payment", operationType: "PAGAMENTO_FATURA" };
      await assert.rejects(processReviewedTransaction(tx, userId, cardPayment, creditMapping, { ...creditValue, transactionId: cardPayment.id }), (error) => error instanceof OpenFinanceError && error.code === "payment");
      await tx.openFinanceConnection.delete({ where: { id: connection.id } });
      assert.ok(await tx.transaction.findUnique({ where: { id: retained.id } }));
      throw rollback;
    }, { timeout: 60000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log("Database checks passed and rolled back: edited fields persisted, private/wrong-type categories rejected, stale/pending rows blocked, original/edited duplicate prevention, unique receipts and transaction retention.");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
