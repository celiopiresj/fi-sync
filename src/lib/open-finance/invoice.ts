import type { Prisma } from "@/generated/prisma/client";
import { dateOnlyKey, formatLocalCalendarDate, toAppZoned } from "@/lib/date";
import { computeInvoiceCycle } from "@/lib/invoice-resolution";
import { prisma } from "@/lib/prisma";

// Read-only "which invoice will this purchase land in" for the review
// screen. Saving resolves the same invoice with resolveInvoiceForDate, so
// the owner never picks invoice dates by hand.
export async function invoiceDatesFor(
  accountId: string,
  cardDetails: { closingDay: number; dueDay: number },
  date: Date,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const cycle = computeInvoiceCycle(date, cardDetails);
  const existing = await client.invoice.findUnique({
    where: { accountId_closingDate: { accountId, closingDate: cycle.closingDate } },
    select: { closingDate: true, dueDate: true },
  });
  // Computed dates are instants in APP_TIME_ZONE, unlike dates read back
  // from Postgres. Each representation keeps its own calendar day.
  return existing
    ? { closingDate: dateOnlyKey(existing.closingDate), dueDate: dateOnlyKey(existing.dueDate) }
    : {
        closingDate: formatLocalCalendarDate(toAppZoned(cycle.closingDate)),
        dueDate: formatLocalCalendarDate(toAppZoned(cycle.dueDate)),
      };
}
