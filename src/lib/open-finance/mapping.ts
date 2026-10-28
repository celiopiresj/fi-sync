import type { Prisma } from "@/generated/prisma/client";
import { parseCalendarDate } from "@/lib/date";
import { OpenFinanceError, type MappingValues } from "@/lib/open-finance/schema";

// This is the owner's last-used import destination, not an exclusive
// bank binding. Changing it never moves transactions or resets receipts.
export async function saveSourceMapping(tx: Prisma.TransactionClient, userId: string, value: MappingValues) {
  await tx.$queryRaw`SELECT "id" FROM "OpenFinanceSource" WHERE "id" = ${value.sourceId} FOR UPDATE`;
  const source = await tx.openFinanceSource.findFirst({ where: { id: value.sourceId, connection: { userId, active: true } } });
  const account = await tx.account.findFirst({ where: { id: value.accountId, userId, status: "ACTIVE" }, include: { creditCardDetails: true } });
  const credit = source?.type === "CREDIT";
  if (!source || !account || source.currency !== "BRL" || account.currency !== "BRL" ||
    (credit ? account.type !== "CREDIT_CARD" || !account.creditCardDetails : !["CHECKING", "SAVINGS"].includes(account.type))) throw new OpenFinanceError("mapping");
  if (credit && !await tx.card.findFirst({ where: { id: value.cardId, accountId: account.id, status: "ACTIVE" } })) throw new OpenFinanceError("mapping");
  await tx.openFinanceSource.update({ where: { id: source.id }, data: {
    accountId: account.id, cardId: credit ? value.cardId : null, importFromDate: parseCalendarDate(value.fromDate),
  } });
}

export async function clearSourceMapping(tx: Prisma.TransactionClient, userId: string, sourceId: string) {
  await tx.$queryRaw`SELECT "id" FROM "OpenFinanceSource" WHERE "id" = ${sourceId} FOR UPDATE`;
  const source = await tx.openFinanceSource.findFirst({ where: { id: sourceId, connection: { userId, active: true } } });
  if (!source) throw new OpenFinanceError("access");
  await tx.openFinanceSource.update({ where: { id: sourceId }, data: { accountId: null, cardId: null, importFromDate: null } });
}
