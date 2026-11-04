"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dateOnlyKey, formatLocalCalendarDate, parseCalendarDate, toAppZoned, todayCalendarDate } from "@/lib/date";
import { importMonths, monthRange } from "@/lib/open-finance/months";
import { findExistingMatches } from "@/lib/open-finance/existing";
import { formatPersonName } from "@/lib/format-person-name";
import { computeInvoiceCycle } from "@/lib/invoice-resolution";
import { requireOpenFinanceOwner } from "@/lib/open-finance/auth";
import { isPluggyConfigured } from "@/lib/open-finance/access";
import { openFinanceError } from "@/lib/open-finance/errors";
import { createPluggyClient } from "@/lib/open-finance/pluggy";
import { savePluggyConnection } from "@/lib/open-finance/connections";
import { registerPluggyWidgetItem } from "@/lib/open-finance/register-widget-item";
import { processReviewedTransaction } from "@/lib/open-finance/process";
import { saveSourceMapping, clearSourceMapping } from "@/lib/open-finance/mapping";
import { pluggyWebhookSecret, publicAppOrigin } from "@/lib/open-finance/widget";
import { inferPaymentMethod, isCardPayment, normalizedAmount, transactionKey } from "@/lib/open-finance/normalize";
import { connectionSchema, mappingSchema, OpenFinanceError, previewSchema, processSchema, reviewRequestSchema, sourceIdSchema, widgetRegistrationSchema } from "@/lib/open-finance/schema";

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
  const [connections, accounts, categories, people] = await Promise.all([
    prisma.openFinanceConnection.findMany({
      where: { userId }, orderBy: { createdAt: "asc" }, include: { sources: { orderBy: { name: "asc" } } },
    }),
    prisma.account.findMany({
      where: { userId, status: "ACTIVE", type: { in: ["CHECKING", "SAVINGS", "CREDIT_CARD"] } },
      select: { id: true, name: true, type: true, currency: true, cards: { where: { status: "ACTIVE" }, select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { OR: [{ userId }, { userId: null }], type: { in: ["EXPENSE", "INCOME"] } },
      select: { id: true, name: true, type: true }, orderBy: { name: "asc" },
    }),
    prisma.person.findMany({
      where: { userId },
      select: { id: true, name: true, isSelf: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const defaultPersonId = people.find((person) => person.isSelf)?.id ?? people[0]?.id ?? "";
  return {
    configured: isPluggyConfigured(), accounts, categories, people, defaultPersonId,
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
    await prisma.$transaction((tx) => saveSourceMapping(tx, userId, value));
    return { error: null };
  } catch (error) { return { error: await openFinanceError(error) }; }
}

export async function clearOpenFinanceMapping(input: unknown) {
  const userId = await requireOpenFinanceOwner();
  try {
    const sourceId = sourceIdSchema.safeParse(input);
    if (!sourceId.success) throw new OpenFinanceError("invalid");
    await prisma.$transaction((tx) => clearSourceMapping(tx, userId, sourceId.data));
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
    const fromDate = dateOnlyKey(source.importFromDate);
    // Only months between the import start and today (next month for
    // cards) are browsable; anything else is a tampered request.
    if (!importMonths(fromDate, todayCalendarDate(), source.type).includes(parsed.data.month)) throw new OpenFinanceError("invalid");
    const range = monthRange(parsed.data.month, fromDate);
    const page = await client.page(source.externalAccountId, range.dateFrom, range.dateTo, parsed.data.cursor);
    const receipts = await prisma.openFinanceImport.findMany({
      where: { sourceId: source.id, externalKey: { in: page.results.map(transactionKey) } }, select: { externalKey: true },
    });
    const processed = new Set(receipts.map((receipt) => receipt.externalKey));
    const rows = page.results.filter((row) => !processed.has(transactionKey(row))).map((row) => {
      const metadata = row.creditCardMetadata;
      const hasValidInstallment = Boolean(
        metadata?.installmentNumber &&
        metadata.totalInstallments &&
        metadata.installmentNumber <= metadata.totalInstallments,
      );
      return {
        id: row.id, date: row.date.slice(0, 10), description: row.description,
        amount: source.currency === "BRL" && (row.currencyCode === "BRL" || row.amountInAccountCurrency != null) ? normalizedAmount(row, source.type) : null,
        status: row.status, payment: isCardPayment(row, source.type),
        paymentMethod: inferPaymentMethod(row, source.type),
        installmentNumber: hasValidInstallment ? metadata!.installmentNumber! : null,
        installmentCount: hasValidInstallment ? metadata!.totalInstallments! : null,
      };
    });
    const existing = await findExistingMatches(userId, source.accountId, rows);
    return { error: null, data: {
      next: page.next,
      rows: rows.map((row) => ({ ...row, existing: existing.get(row.id) ?? null })),
    } };
  } catch (error) { return { error: await openFinanceError(error), data: null }; }
}

export async function getOpenFinanceReview(input: unknown) {
  const userId = await requireOpenFinanceOwner();
  try {
    const parsed = reviewRequestSchema.safeParse(input);
    if (!parsed.success) throw new OpenFinanceError("invalid");
    const { source, row, amount, date } = await readTransaction(userId, parsed.data.sourceId, parsed.data.transactionId);
    const [matches, categories, people] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, accountId: source.accountId!, date, amount },
        select: { id: true, description: true }, take: 30,
      }),
      prisma.category.findMany({
        where: { OR: [{ userId }, { userId: null }], type: { in: ["EXPENSE", "INCOME"] } },
        select: { id: true, name: true, type: true }, orderBy: { name: "asc" },
      }),
      prisma.person.findMany({
        where: { userId },
        select: { id: true, name: true, isSelf: true },
        orderBy: { name: "asc" },
      }),
    ]);
    const defaultPersonId = people.find((person) => person.isSelf)?.id ?? people[0]?.id ?? "";
    const cycle = source.account?.creditCardDetails ? computeInvoiceCycle(date, source.account.creditCardDetails) : null;
    const existingInvoice = cycle ? await prisma.invoice.findUnique({
      where: { accountId_closingDate: { accountId: source.accountId!, closingDate: cycle.closingDate } },
      select: { closingDate: true, dueDate: true },
    }) : null;
    const metadata = row.creditCardMetadata;
    return { error: null, data: {
      matches, categories, people, defaultPersonId,
      paymentMethod: inferPaymentMethod(row, source.type),
      destination: source.account!.name,
      cardName: source.card?.name ?? "",
      installmentNumber: metadata?.installmentNumber && metadata.totalInstallments && metadata.installmentNumber <= metadata.totalInstallments ? metadata.installmentNumber : null,
      installmentCount: metadata?.installmentNumber && metadata.totalInstallments && metadata.installmentNumber <= metadata.totalInstallments ? metadata.totalInstallments : null,
      destinationSelection: { accountId: source.accountId!, cardId: source.cardId ?? "", fromDate: dateOnlyKey(source.importFromDate!) },
      credit: source.type === "CREDIT", pending: row.status === "PENDING", payment: isCardPayment(row, source.type),
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
    const { source, row } = await readTransaction(userId, value.sourceId, value.transactionId);
    await prisma.$transaction((tx) => processReviewedTransaction(tx, userId, row, {
      accountId: source.accountId, cardId: source.cardId, fromDate: source.importFromDate ? dateOnlyKey(source.importFromDate) : null,
    }, value), { timeout: 20000 });
    const locale = await getLocale();
    revalidatePath(`/${locale}`, "layout");
    return { error: null };
  } catch (error) { return { error: await openFinanceError(error) }; }
}

export async function createOpenFinancePerson(input: unknown) {
  const userId = await requireOpenFinanceOwner();
  try {
    const parsed = sourceIdSchema.safeParse(input);
    if (!parsed.success) throw new OpenFinanceError("invalid");
    const person = await prisma.person.create({
      data: { userId, name: formatPersonName(parsed.data) },
      select: { id: true, name: true },
    });
    const locale = await getLocale();
    revalidatePath(`/${locale}`, "layout");
    return { error: null, person };
  } catch (error) { return { error: await openFinanceError(error), person: null }; }
}
