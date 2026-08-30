import { addMonths, setDate } from "date-fns";
import { prisma } from "@/lib/prisma";
import { toAppZoned, fromAppZoned } from "@/lib/date";
import type { Prisma } from "@/generated/prisma/client";

// Pure calculation of one credit-card billing cycle from the account's
// expected closingDay/dueDay — no Prisma, no side effects. Shared by
// `resolveInvoiceForDate` below (which finds-or-creates the real Invoice
// row) and `previewInvoiceCycle` in transactions/actions.ts (which only
// shows the user where a purchase would land, before anything is saved).
//
// Lives in its own plain module (not a "use server" actions file) for two
// reasons: this one function is synchronous (Server Action files require
// every export to be async), and — since tasks/012 — both
// transactions/actions.ts and recurrences/actions.ts need the identical
// find-or-create-Invoice behavior, so it's shared here instead of
// duplicated a second time.
//
// The `setDate`/`addMonths` math below runs against `toAppZoned(fromDate)`
// (see src/lib/date.ts) rather than `fromDate` directly, so the closing/
// due day always land on the calendar day they would in `APP_TIME_ZONE` —
// not whatever timezone the server process happens to be running in. A
// purchase dated right at the closing day boundary used to be able to
// resolve into the wrong invoice on a server running in UTC.
export function computeInvoiceCycle(
  fromDate: Date,
  cardDetails: { closingDay: number; dueDay: number },
) {
  const zonedFrom = toAppZoned(fromDate);

  // The closing day itself is already the NEXT invoice's opening day —
  // not the last day still accepted by the one closing that day — so a
  // purchase dated exactly on the closing day (`<=`, not `<`) has to push
  // forward a month too, not just one strictly after it.
  let closingDate = setDate(zonedFrom, cardDetails.closingDay);
  if (closingDate <= zonedFrom) {
    closingDate = addMonths(closingDate, 1);
  }
  let dueDate = setDate(closingDate, cardDetails.dueDay);
  if (dueDate < closingDate) {
    dueDate = addMonths(dueDate, 1);
  }

  return {
    closingDate: fromAppZoned(closingDate),
    dueDate: fromAppZoned(dueDate),
  };
}

// The inverse of computeInvoiceCycle above: "fatura atual" colloquially
// means the most recently CLOSED statement (the one due soon, that
// you'd currently be paying off) — not the still-open one accumulating
// new purchases, which is what computeInvoiceCycle(today, ...) returns.
// Used by previewCurrentInvoiceCycle (transactions/actions.ts) to tell a
// backdated/postdated installment purchase which of its installments
// lands on today's actual current statement.
export function computeCurrentInvoiceCycle(
  fromDate: Date,
  cardDetails: { closingDay: number; dueDay: number },
) {
  const zonedFrom = toAppZoned(fromDate);

  // Stays `>` (not `>=`) — this is the exact logical complement of
  // computeInvoiceCycle's own `<=`: that function treats `zonedFrom`
  // landing ON the closing day as already-next-cycle, so this one
  // correctly still counts that same day as "just closed" (today's own
  // cycle), not "closed last month" — the two must never both treat the
  // boundary day as belonging to themselves, or as belonging to neither.
  let closingDate = setDate(zonedFrom, cardDetails.closingDay);
  if (closingDate > zonedFrom) {
    closingDate = addMonths(closingDate, -1);
  }
  let dueDate = setDate(closingDate, cardDetails.dueDay);
  if (dueDate < closingDate) {
    dueDate = addMonths(dueDate, 1);
  }

  return {
    closingDate: fromAppZoned(closingDate),
    dueDate: fromAppZoned(dueDate),
  };
}

// One credit card cycle: finds the Invoice whose closing date is the
// first one on/after `fromDate`, creating it (from CreditCardDetails'
// expected closingDay/dueDay) if that cycle hasn't been generated yet —
// see tasks/004-transactions-screen.md, "Faturas automáticas".
//
// NOT safe to run concurrently (e.g. Promise.all) across several dates
// for the same account: two dates landing in the same billing cycle
// could both see "no existing invoice" and both attempt to create one,
// tripping Invoice's `@@unique([accountId, closingDate])` constraint.
// Every caller (the installment/recurrence generation loops in
// transactions/actions.ts, and the occurrence generation loop in
// recurrences/actions.ts) must keep awaiting this one date at a time, in
// a plain `for` loop — never `Promise.all`. As cheap insurance against
// that same race with a caller OUTSIDE this module's control (e.g.
// payInvoice, invoices/actions.ts, force-creating a future invoice to
// attach an overpayment credit to, concurrently with a recurrence
// generation loop touching the same account), a P2002 on the create
// falls back to re-`findFirst` instead of throwing.
//
// `client` defaults to the shared global `prisma`, but accepts a
// `Prisma.TransactionClient` so a caller running its own interactive
// `prisma.$transaction(async (tx) => ...)` can keep this atomic with the
// rest of that transaction instead of committing outside it.
export async function resolveInvoiceForDate(
  accountId: string,
  fromDate: Date,
  cardDetails: { closingDay: number; dueDay: number },
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  // computeInvoiceCycle is a pure, deterministic function of fromDate —
  // there's exactly one correct cycle for it, so the lookup below has to
  // be an EXACT match on that cycle's closingDate, not "the nearest
  // invoice that happens to exist on or after fromDate" (the old
  // `findFirst(... gte: fromDate ...)` query). Invoices are created
  // lazily, one per cycle a transaction actually lands in, so an account
  // can easily have gaps — e.g. April's invoice exists (an old purchase)
  // and August's does too (today's), but May/June/July never got one.
  // A ">=" search over that gap would jump straight from April to
  // August, silently attaching several installments' worth of months to
  // the wrong invoice. The `@@unique([accountId, closingDate])` index
  // makes an exact match just as cheap.
  const { closingDate, dueDate } = computeInvoiceCycle(fromDate, cardDetails);

  const existing = await client.invoice.findUnique({
    where: { accountId_closingDate: { accountId, closingDate } },
  });

  if (existing) return existing;

  try {
    return await client.invoice.create({
      data: { accountId, closingDate, dueDate, status: "OPEN" },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const created = await client.invoice.findUnique({
        where: { accountId_closingDate: { accountId, closingDate } },
      });
      if (created) return created;
    }
    throw error;
  }
}
