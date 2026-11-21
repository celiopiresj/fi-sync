import type { Prisma } from "@/generated/prisma/client";
import { dateOnlyKey, parseCalendarDate } from "@/lib/date";
import { recomputeInvoiceStatus } from "@/lib/invoice-total";
import { resolveInvoiceForDate } from "@/lib/invoice-resolution";
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
  if (value.expectedDestination.accountId !== source.accountId || value.expectedDestination.cardId !== (source.cardId ?? "") ||
    value.expectedDestination.fromDate !== dateOnlyKey(source.importFromDate)) throw new OpenFinanceError("mappingChanged");
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
    if (isCardPayment(row, source.type)) throw new OpenFinanceError("payment");
    const edited = reviewedTransaction(value.edits);
    // Check both the original bank record and the edited values. Editing
    // a date or amount must not bypass an existing transaction's warning.
    await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${source.accountId} FOR UPDATE`;
    const destination = await tx.account.findFirst({ where: { id: source.accountId, userId, status: "ACTIVE", currency: "BRL" }, include: { creditCardDetails: true } });
    if (!destination || source.currency !== "BRL" ||
      (source.type === "CREDIT" ? destination.type !== "CREDIT_CARD" : !["CHECKING", "SAVINGS"].includes(destination.type))) throw new OpenFinanceError("mapping");
    if (!value.allowDuplicate && await tx.transaction.findFirst({ where: { userId, accountId: source.accountId, OR: [{ date, amount }, { date: edited.date, amount: edited.amount }] } })) {
      throw new OpenFinanceError("duplicate");
    }
    if (edited.categoryId && !await tx.category.findFirst({ where: {
      id: edited.categoryId, type: value.edits.type === "expense" ? "EXPENSE" : "INCOME", OR: [{ userId }, { userId: null }],
    } })) throw new OpenFinanceError("invalid");
    if (edited.splits.length > 0) {
      const personIds = edited.splits.map((split) => split.personId);
      if (new Set(personIds).size !== personIds.length) throw new OpenFinanceError("invalid");
      if (await tx.person.count({ where: { userId, id: { in: personIds } } }) !== personIds.length) {
        throw new OpenFinanceError("invalid");
      }
    }
    if (source.type === "CREDIT" && edited.paymentMethod) throw new OpenFinanceError("invalid");
    if (source.type === "BANK" && edited.paymentMethod === "CREDIT_CARD") throw new OpenFinanceError("invalid");
    let invoiceId: string | null = null;
    if (source.type === "CREDIT") {
      if (!source.card || source.card.status !== "ACTIVE" || source.card.accountId !== source.accountId ||
        !destination.creditCardDetails) throw new OpenFinanceError("invoice");
      // The invoice follows the (edited) purchase date and the card's
      // cycle, exactly like a purchase created on the transactions screen.
      invoiceId = (await resolveInvoiceForDate(source.accountId, edited.date, destination.creditCardDetails, tx)).id;
    }
    const metadata = row.creditCardMetadata;
    const { splits, paymentMethod, ...transactionData } = edited;
    const transaction = await tx.transaction.create({ data: {
      // A bank-pending row is saved as PENDING; card purchases are completed
      // once their date arrives (completePastPendingCardPurchases).
      userId, accountId: source.accountId, ...transactionData, status: row.status === "PENDING" ? "PENDING" : "COMPLETED",
      ...(source.type === "BANK" && paymentMethod ? { paymentMethod } : {}),
      ...(splits.length > 0 ? { splits: { create: splits } } : {}),
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
