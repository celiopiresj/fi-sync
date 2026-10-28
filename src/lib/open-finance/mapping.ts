import type { Prisma } from "@/generated/prisma/client";
import { parseCalendarDate } from "@/lib/date";
import { OpenFinanceError, type MappingValues } from "@/lib/open-finance/schema";

export async function saveSourceMapping(tx: Prisma.TransactionClient, userId: string, value: MappingValues) {
  await tx.$queryRaw`SELECT "id" FROM "OpenFinanceSource" WHERE "id" = ${value.sourceId} FOR UPDATE`;
  const source = await tx.openFinanceSource.findFirst({ where: { id: value.sourceId, connection: { userId, active: true } } });
  const account = await tx.account.findFirst({ where: { id: value.accountId, userId, status: "ACTIVE" }, include: { creditCardDetails: true } });
  await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${value.accountId} FOR UPDATE`;
  const credit = source?.type === "CREDIT";
  if (!source || !account || source.currency !== "BRL" || account.currency !== "BRL" ||
    (credit ? account.type !== "CREDIT_CARD" || !account.creditCardDetails : !["CHECKING", "SAVINGS"].includes(account.type))) throw new OpenFinanceError("mapping");
  if (credit && !await tx.card.findFirst({ where: { id: value.cardId, accountId: account.id, status: "ACTIVE" } })) throw new OpenFinanceError("mapping");
  if (source.accountId !== account.id && await tx.openFinanceImport.count({ where: { sourceId: source.id } })) throw new OpenFinanceError("mappingLocked");
  const conflict = await tx.openFinanceSource.findFirst({ where: {
    id: { not: source.id }, accountId: account.id, connection: { userId, active: true }, ...(credit ? { cardId: value.cardId } : {}),
  }, include: { connection: { select: { label: true } } } });
  if (conflict) throw new OpenFinanceError("mappingConflict", { account: account.name, source: `${conflict.connection.label} · ${conflict.name}` });
  await tx.openFinanceSource.update({ where: { id: source.id }, data: {
    accountId: account.id, cardId: credit ? value.cardId : null, importFromDate: parseCalendarDate(value.fromDate),
  } });
}

export async function clearSourceMapping(tx: Prisma.TransactionClient, userId: string, sourceId: string) {
  await tx.$queryRaw`SELECT "id" FROM "OpenFinanceSource" WHERE "id" = ${sourceId} FOR UPDATE`;
  const source = await tx.openFinanceSource.findFirst({ where: { id: sourceId, connection: { userId, active: true } } });
  if (!source) throw new OpenFinanceError("access");
  if (await tx.openFinanceImport.count({ where: { sourceId } })) throw new OpenFinanceError("mappingLocked");
  await tx.openFinanceSource.update({ where: { id: sourceId }, data: { accountId: null, cardId: null, importFromDate: null } });
}
