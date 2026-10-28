import type { Prisma } from "@/generated/prisma/client";
import { dateOnlyKey, parseCalendarDate } from "@/lib/date";
import { recomputeInvoiceStatus } from "@/lib/invoice-total";
import { isCardPayment, normalizedAmount, transactionKey } from "@/lib/open-finance/normalize";
import { OpenFinanceError, type PluggyTransaction, type ProcessValues } from "@/lib/open-finance/schema";
import { reviewedTransaction } from "@/lib/open-finance/review";
import type { SourceMapping } from "@/lib/open-finance/types";

// The caller supplies a freshly fetched provider row, never a client row,
// and runs this write and its receipt in one shared Prisma transaction.
export async function processReviewedTransaction(tx: Prisma.TransactionClient, userId: string, row: PluggyTransaction, mapping: SourceMapping, value: ProcessValues) {
  await tx.$queryRaw`SELECT "id" FROM "OpenFinanceSource" WHERE "id" = ${value.sourceId} FOR UPDATE`;
  const source = await tx.openFinanceSource.findFirst({
    where: { id: value.sourceId, connection: { userId, active: true } }, include: { card: true },
  });
  if (!source || !source.accountId || source.accountId !== mapping.accountId || source.cardId !== mapping.cardId ||
    !source.importFromDate || dateOnlyKey(source.importFromDate) !== mapping.fromDate) throw new OpenFinanceError("mapping");
  if (row.accountId !== source.externalAccountId || row.id !== value.transactionId) throw new OpenFinanceError("access");
  const externalKey = transactionKey(row);
  if (await tx.openFinanceImport.findUnique({ where: { sourceId_externalKey: { sourceId: source.id, externalKey } } })) return;
  const amount = normalizedAmount(row, source.type);
  const date = parseCalendarDate(row.date.slice(0, 10));
  if (amount !== value.expectedAmount || row.date.slice(0, 10) !== value.expectedDate || row.description !== value.expectedDescription) {
    throw new OpenFinanceError("stale");
  }
  let transactionId: string | null = null;
  if (value.mode === "match") {
    const existing = await tx.transaction.findFirst({ where: {
      id: value.existingTransactionId, userId, accountId: source.accountId, amount, date,
    } });
    if (!existing) throw new OpenFinanceError("invalid");
    transactionId = existing.id;
  } else if (value.mode === "create") {
    if (row.status !== "POSTED") throw new OpenFinanceError("pending");
    if (isCardPayment(row, source.type)) throw new OpenFinanceError("payment");
    const edited = reviewedTransaction(value.edits);
    // Check both the original bank record and the edited values. Editing
    // a date or amount must not bypass an existing transaction's warning.
    await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${source.accountId} FOR UPDATE`;
    const destination = await tx.account.findFirst({ where: { id: source.accountId, userId, status: "ACTIVE", currency: "BRL" } });
    if (!destination || source.currency !== "BRL" ||
      (source.type === "CREDIT" ? destination.type !== "CREDIT_CARD" : !["CHECKING", "SAVINGS"].includes(destination.type))) throw new OpenFinanceError("mapping");
    if (await tx.transaction.findFirst({ where: { userId, accountId: source.accountId, OR: [{ date, amount }, { date: edited.date, amount: edited.amount }] } })) {
      throw new OpenFinanceError("duplicate");
    }
    if (edited.categoryId && !await tx.category.findFirst({ where: {
      id: edited.categoryId, type: value.edits.type === "expense" ? "EXPENSE" : "INCOME", OR: [{ userId }, { userId: null }],
    } })) throw new OpenFinanceError("invalid");
    let invoiceId: string | null = null;
    if (source.type === "CREDIT") {
      if (!source.card || source.card.status !== "ACTIVE" || source.card.accountId !== source.accountId || !value.closingDate || !value.dueDate ||
        value.dueDate < value.closingDate || value.closingDate < value.edits.date) throw new OpenFinanceError("invoice");
      const invoice = await tx.invoice.upsert({
        where: { accountId_closingDate: { accountId: source.accountId, closingDate: parseCalendarDate(value.closingDate) } },
        create: { accountId: source.accountId, closingDate: parseCalendarDate(value.closingDate), dueDate: parseCalendarDate(value.dueDate) }, update: {},
      });
      if (dateOnlyKey(invoice.dueDate) !== value.dueDate) throw new OpenFinanceError("invoice");
      invoiceId = invoice.id;
    }
    const metadata = row.creditCardMetadata;
    const transaction = await tx.transaction.create({ data: {
      userId, accountId: source.accountId, ...edited, status: "COMPLETED",
      ...(metadata?.installmentNumber && metadata.totalInstallments && metadata.installmentNumber <= metadata.totalInstallments ? {
        installmentNumber: metadata.installmentNumber, installmentCount: metadata.totalInstallments,
      } : {}),
      ...(invoiceId ? { transactionInvoice: { create: { invoiceId } }, transactionCard: { create: { cardId: source.cardId! } } } : {}),
    } });
    transactionId = transaction.id;
    if (invoiceId) await recomputeInvoiceStatus(tx, invoiceId);
  }
  await tx.openFinanceImport.create({ data: { sourceId: source.id, externalKey, transactionId } });
}
