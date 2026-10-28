"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dateOnlyKey, formatLocalCalendarDate, parseCalendarDate, toAppZoned } from "@/lib/date";
import { computeInvoiceCycle } from "@/lib/invoice-resolution";
import { recomputeInvoiceStatus } from "@/lib/invoice-total";
import { requireOpenFinanceOwner } from "@/lib/open-finance/auth";
import { isPluggyConfigured } from "@/lib/open-finance/access";
import { openFinanceError } from "@/lib/open-finance/errors";
import { createPluggyClient } from "@/lib/open-finance/pluggy";
import { savePluggyConnection } from "@/lib/open-finance/connections";
import { registerPluggyWidgetItem } from "@/lib/open-finance/register-widget-item";
import { pluggyWebhookSecret, publicAppOrigin } from "@/lib/open-finance/widget";
import { isCardPayment, normalizedAmount, transactionKey } from "@/lib/open-finance/normalize";
import { connectionSchema, mappingSchema, OpenFinanceError, previewSchema, processSchema, sourceIdSchema, widgetRegistrationSchema } from "@/lib/open-finance/schema";

export async function createOpenFinanceConnectToken() {
  const userId = await requireOpenFinanceOwner();
  try {
    const origin = publicAppOrigin();
    const client = await createPluggyClient();
    if (origin) {
      const signature = pluggyWebhookSecret();
      if (!signature) throw new OpenFinanceError("configuration");
      await client.ensureWebhooks(`${origin}/api/open-finance/pluggy`, signature);
    }
    const token = await client.meuPluggyConnectToken({ clientUserId: userId,
      ...(origin ? { oauthRedirectUri: `${origin}/${await getLocale()}/open-finance` } : {}),
    });
    return { error: null, accessToken: token.accessToken };
  } catch (error) { return { error: await openFinanceError(error), accessToken: null }; }
}

export async function registerOpenFinanceWidgetConnection(input: unknown) {
  const userId = await requireOpenFinanceOwner();
  try {
    const value = widgetRegistrationSchema.safeParse(input);
    if (!value.success) throw new OpenFinanceError("invalid");
    await registerPluggyWidgetItem(userId, value.data.itemId, true);
    return { error: null };
  } catch (error) { return { error: await openFinanceError(error) }; }
}

async function ownedSource(userId: string, sourceId: string) {
  const source = await prisma.openFinanceSource.findFirst({
    where: { id: sourceId, connection: { userId, active: true } },
    include: { connection: true, account: { include: { creditCardDetails: true } }, card: true },
  });
  if (!source) throw new OpenFinanceError("access");
  return source;
}

async function readTransaction(userId: string, sourceId: string, transactionId: string) {
  const source = await ownedSource(userId, sourceId);
  if (!source.account || source.account.userId !== userId || source.account.status !== "ACTIVE" || !source.importFromDate) {
    throw new OpenFinanceError("mapping");
  }
  const client = await createPluggyClient();
  const item = await client.item(source.connection.itemId);
  if (item.id !== source.connection.itemId || item.status === "LOGIN_ERROR" ||
    (item.consentExpiresAt && new Date(item.consentExpiresAt) <= new Date())) throw new OpenFinanceError("provider");
  const row = await client.transaction(source.externalAccountId, transactionId);
  if (row.date.slice(0, 10) < dateOnlyKey(source.importFromDate)) throw new OpenFinanceError("invalid");
  if (source.currency !== "BRL" || source.account.currency !== "BRL") throw new OpenFinanceError("currency");
  return { source, row, amount: normalizedAmount(row, source.type), date: parseCalendarDate(row.date.slice(0, 10)) };
}

export async function getOpenFinanceOverview() {
  const userId = await requireOpenFinanceOwner();
  const [connections, accounts] = await Promise.all([
    prisma.openFinanceConnection.findMany({
      where: { userId }, orderBy: { createdAt: "asc" }, include: { sources: { orderBy: { name: "asc" } } },
    }),
    prisma.account.findMany({
      where: { userId, status: "ACTIVE", type: { in: ["CHECKING", "SAVINGS", "CREDIT_CARD"] } },
      select: { id: true, name: true, type: true, currency: true, cards: { where: { status: "ACTIVE" }, select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    configured: isPluggyConfigured(), accounts,
    connections: connections.map((connection) => ({
      id: connection.id, label: connection.label, active: connection.active,
      sources: connection.sources.map((source) => ({
        id: source.id, name: source.name, type: source.type, currency: source.currency,
        accountId: source.accountId, cardId: source.cardId,
        fromDate: source.importFromDate ? dateOnlyKey(source.importFromDate) : null,
      })),
    })),
  };
}

export async function addOpenFinanceConnection(input: unknown) {
  const userId = await requireOpenFinanceOwner();
  try {
    const parsed = connectionSchema.safeParse(input);
    if (!parsed.success) throw new OpenFinanceError("invalid");
    const client = await createPluggyClient();
    const item = await client.item(parsed.data.itemId);
    if (item.id !== parsed.data.itemId || (item.consentExpiresAt && new Date(item.consentExpiresAt) <= new Date())) {
      throw new OpenFinanceError("provider");
    }
    const accounts = await client.accounts(item.id);
    await savePluggyConnection(userId, item.id, parsed.data.label, accounts, true);
    return { error: null };
  } catch (error) { return { error: await openFinanceError(error) }; }
}

export async function setOpenFinanceConnectionActive(input: unknown) {
  const userId = await requireOpenFinanceOwner();
  try {
    // Only disabling is supported here. Re-adding the same item validates
    // its authorization again and preserves mappings and import receipts.
    const id = sourceIdSchema.safeParse(input);
    if (!id.success) throw new OpenFinanceError("invalid");
    await prisma.openFinanceConnection.updateMany({ where: { id: id.data, userId }, data: { active: false } });
    return { error: null };
  } catch (error) { return { error: await openFinanceError(error) }; }
}

export async function saveOpenFinanceMapping(input: unknown) {
  const userId = await requireOpenFinanceOwner();
  try {
    const parsed = mappingSchema.safeParse(input);
    if (!parsed.success) throw new OpenFinanceError("invalid");
    const value = parsed.data;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "OpenFinanceSource" WHERE "id" = ${value.sourceId} FOR UPDATE`;
      const source = await tx.openFinanceSource.findFirst({ where: { id: value.sourceId, connection: { userId, active: true } } });
      const account = await tx.account.findFirst({
        where: { id: value.accountId, userId, status: "ACTIVE" }, include: { creditCardDetails: true },
      });
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${value.accountId} FOR UPDATE`;
      const credit = source?.type === "CREDIT";
      if (!source || !account || source.currency !== "BRL" || account.currency !== "BRL" ||
        (credit ? account.type !== "CREDIT_CARD" || !account.creditCardDetails : !["CHECKING", "SAVINGS"].includes(account.type))) {
        throw new OpenFinanceError("mapping");
      }
      if (credit && !await tx.card.findFirst({ where: { id: value.cardId, accountId: account.id, status: "ACTIVE" } })) {
        throw new OpenFinanceError("mapping");
      }
      if (source.accountId !== account.id && await tx.openFinanceImport.count({ where: { sourceId: source.id } })) {
        throw new OpenFinanceError("mapping");
      }
      // One bank account must not be imported twice through two connections.
      if (await tx.openFinanceSource.findFirst({ where: {
        id: { not: source.id }, accountId: account.id, connection: { userId, active: true },
        ...(credit ? { cardId: value.cardId } : {}),
      } })) throw new OpenFinanceError("mapping");
      await tx.openFinanceSource.update({ where: { id: source.id }, data: {
        accountId: account.id, cardId: credit ? value.cardId : null, importFromDate: parseCalendarDate(value.fromDate),
      } });
    });
    return { error: null };
  } catch (error) { return { error: await openFinanceError(error) }; }
}

export async function getOpenFinanceTransactions(input: unknown) {
  const userId = await requireOpenFinanceOwner();
  try {
    const parsed = previewSchema.safeParse(input);
    if (!parsed.success) throw new OpenFinanceError("invalid");
    const source = await ownedSource(userId, parsed.data.sourceId);
    if (!source.importFromDate || !source.accountId || source.account?.userId !== userId) throw new OpenFinanceError("mapping");
    const client = await createPluggyClient();
    const item = await client.item(source.connection.itemId);
    if (item.id !== source.connection.itemId || item.status === "LOGIN_ERROR" ||
      (item.consentExpiresAt && new Date(item.consentExpiresAt) <= new Date())) throw new OpenFinanceError("provider");
    const page = await client.page(source.externalAccountId, dateOnlyKey(source.importFromDate), parsed.data.cursor);
    const receipts = await prisma.openFinanceImport.findMany({
      where: { sourceId: source.id, externalKey: { in: page.results.map(transactionKey) } }, select: { externalKey: true },
    });
    const processed = new Set(receipts.map((receipt) => receipt.externalKey));
    return { error: null, data: {
      next: page.next,
      rows: page.results.filter((row) => !processed.has(transactionKey(row))).map((row) => ({
        id: row.id, date: row.date.slice(0, 10), description: row.description,
        amount: source.currency === "BRL" && (row.currencyCode === "BRL" || row.amountInAccountCurrency != null) ? normalizedAmount(row, source.type) : null,
        status: row.status, payment: isCardPayment(row, source.type),
      })),
    } };
  } catch (error) { return { error: await openFinanceError(error), data: null }; }
}

export async function getOpenFinanceReview(input: unknown) {
  const userId = await requireOpenFinanceOwner();
  try {
    const parsed = processSchema.pick({ sourceId: true, transactionId: true }).safeParse(input);
    if (!parsed.success) throw new OpenFinanceError("invalid");
    const { source, row, amount, date } = await readTransaction(userId, parsed.data.sourceId, parsed.data.transactionId);
    const matches = await prisma.transaction.findMany({
      where: { userId, accountId: source.accountId!, date, amount },
      select: { id: true, description: true }, take: 30,
    });
    const cycle = source.account?.creditCardDetails ? computeInvoiceCycle(date, source.account.creditCardDetails) : null;
    const existingInvoice = cycle ? await prisma.invoice.findUnique({
      where: { accountId_closingDate: { accountId: source.accountId!, closingDate: cycle.closingDate } },
      select: { closingDate: true, dueDate: true },
    }) : null;
    return { error: null, data: {
      matches, credit: source.type === "CREDIT", pending: row.status === "PENDING", payment: isCardPayment(row, source.type),
      description: row.description, amount, date: row.date.slice(0, 10),
      // Computed dates are instants in APP_TIME_ZONE, unlike dates read
      // back from Postgres. This representation keeps their calendar day.
      closingDate: existingInvoice ? dateOnlyKey(existingInvoice.closingDate) : cycle ? formatLocalCalendarDate(toAppZoned(cycle.closingDate)) : "",
      dueDate: existingInvoice ? dateOnlyKey(existingInvoice.dueDate) : cycle ? formatLocalCalendarDate(toAppZoned(cycle.dueDate)) : "",
    } };
  } catch (error) { return { error: await openFinanceError(error), data: null }; }
}

export async function processOpenFinanceTransaction(input: unknown) {
  const userId = await requireOpenFinanceOwner();
  try {
    const parsed = processSchema.safeParse(input);
    if (!parsed.success) throw new OpenFinanceError("invalid");
    const value = parsed.data;
    const { source, row, amount, date } = await readTransaction(userId, value.sourceId, value.transactionId);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "OpenFinanceSource" WHERE "id" = ${source.id} FOR UPDATE`;
      const current = await tx.openFinanceSource.findFirst({ where: { id: source.id, connection: { userId, active: true } } });
      if (!current || current.accountId !== source.accountId || current.cardId !== source.cardId ||
        current.importFromDate?.getTime() !== source.importFromDate?.getTime()) throw new OpenFinanceError("mapping");
      const externalKey = transactionKey(row);
      if (await tx.openFinanceImport.findUnique({ where: { sourceId_externalKey: { sourceId: source.id, externalKey } } })) return;
      if (amount !== value.expectedAmount || row.date.slice(0, 10) !== value.expectedDate || row.description !== value.expectedDescription) {
        throw new OpenFinanceError("stale");
      }
      let transactionId: string | null = null;
      if (value.mode === "match") {
        const existing = await tx.transaction.findFirst({ where: {
          id: value.existingTransactionId, userId, accountId: source.accountId!, amount, date,
        } });
        if (!existing) throw new OpenFinanceError("invalid");
        transactionId = existing.id;
      } else if (value.mode === "create") {
        if (row.status !== "POSTED") throw new OpenFinanceError("pending");
        if (isCardPayment(row, source.type)) throw new OpenFinanceError("payment");
        // Serialize duplicate checks across different sources mapped to
        // one local account as well as concurrent requests for this source.
        await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${source.accountId} FOR UPDATE`;
        const destination = await tx.account.findFirst({ where: { id: source.accountId!, userId, status: "ACTIVE", currency: "BRL" } });
        if (!destination || (source.type === "CREDIT" ? destination.type !== "CREDIT_CARD" : !["CHECKING", "SAVINGS"].includes(destination.type))) {
          throw new OpenFinanceError("mapping");
        }
        if (await tx.transaction.findFirst({ where: { userId, accountId: source.accountId!, date, amount } })) throw new OpenFinanceError("duplicate");
        let invoiceId: string | null = null;
        if (source.type === "CREDIT") {
          if (!source.card || source.card.status !== "ACTIVE" || source.card.accountId !== source.accountId || !value.closingDate || !value.dueDate ||
            value.dueDate < value.closingDate || value.closingDate < row.date.slice(0, 10)) throw new OpenFinanceError("invoice");
          const closingDate = parseCalendarDate(value.closingDate);
          const dueDate = parseCalendarDate(value.dueDate);
          const invoice = await tx.invoice.upsert({
            where: { accountId_closingDate: { accountId: source.accountId!, closingDate } },
            create: { accountId: source.accountId!, closingDate, dueDate }, update: {},
          });
          if (dateOnlyKey(invoice.dueDate) !== value.dueDate) throw new OpenFinanceError("invoice");
          invoiceId = invoice.id;
        }
        const metadata = row.creditCardMetadata;
        const transaction = await tx.transaction.create({ data: {
          userId, accountId: source.accountId!, description: row.description, amount, date, status: "COMPLETED",
          ...(metadata?.installmentNumber && metadata.totalInstallments && metadata.installmentNumber <= metadata.totalInstallments ? {
            installmentNumber: metadata.installmentNumber, installmentCount: metadata.totalInstallments,
          } : {}),
          ...(invoiceId ? { transactionInvoice: { create: { invoiceId } }, transactionCard: { create: { cardId: source.cardId! } } } : {}),
        } });
        transactionId = transaction.id;
        if (invoiceId) await recomputeInvoiceStatus(tx, invoiceId);
      }
      await tx.openFinanceImport.create({ data: { sourceId: source.id, externalKey, transactionId } });
    }, { timeout: 20000 });
    const locale = await getLocale();
    revalidatePath(`/${locale}`, "layout");
    return { error: null };
  } catch (error) { return { error: await openFinanceError(error) }; }
}
