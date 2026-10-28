import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { OpenFinanceError, type PluggyAccount } from "@/lib/open-finance/schema";

export async function savePluggyConnection(userId: string, itemId: string, label: string, accounts: PluggyAccount[], reactivate: boolean, transaction?: Prisma.TransactionClient) {
  async function write(tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const existing = await tx.openFinanceConnection.findUnique({ where: { itemId } });
    if (existing && existing.userId !== userId) throw new OpenFinanceError("access");
    // A delayed notification must never undo the user's choice to disable.
    if (existing && !existing.active && !reactivate) return;
    if (!existing?.active && await tx.openFinanceConnection.count({ where: { userId, active: true } }) >= 5) {
      throw new OpenFinanceError("invalid");
    }
    const connection = await tx.openFinanceConnection.upsert({
      where: { itemId }, create: { userId, itemId, label: label.slice(0, 80) },
      update: { ...(reactivate ? { active: true } : {}) },
    });
    for (const account of accounts) {
      if (account.itemId !== itemId) throw new OpenFinanceError("access");
      await tx.openFinanceSource.upsert({
        where: { connectionId_externalAccountId: { connectionId: connection.id, externalAccountId: account.id } },
        create: { connectionId: connection.id, externalAccountId: account.id, name: account.name, type: account.type, currency: account.currencyCode },
        update: { name: account.name, type: account.type, currency: account.currencyCode },
      });
    }
  }
  if (transaction) await write(transaction);
  else await prisma.$transaction(write);
}
