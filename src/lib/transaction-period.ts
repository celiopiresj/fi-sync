import { parseCalendarDate } from "@/lib/date";

// Scopes a period ("from"/"to", already "yyyy-MM-dd" strings) to either
// the transaction's own date (everything except credit-card purchases)
// or its linked invoice's dueDate (credit-card purchases) — a card
// purchase belongs to whichever month you'll actually pay for it in, not
// the month you swiped the card, mirroring /invoices' own
// closingDate->dueDate switch (see invoices/actions.ts's listInvoices).
//
// Lives here rather than inside transactions/actions.ts because it isn't
// only that screen's rule anymore: every list/aggregate query filtered by
// period has to agree on it (listTransactions, getTransactionById,
// getMonthlyBalances, getCategoryExpenseBreakdown) and so does the
// Telegram bot's own reading of "gastos do mês" (src/lib/telegram/tools.ts)
// — a second, hand-rolled copy of this is exactly how the two would drift.
export function effectiveDateWhere(
  from?: string,
  to?: string,
): Record<string, unknown> {
  if (!from && !to) return {};
  const range = {
    ...(from ? { gte: parseCalendarDate(from) } : {}),
    ...(to ? { lte: parseCalendarDate(to) } : {}),
  };
  return {
    OR: [
      { account: { type: { not: "CREDIT_CARD" } }, date: range },
      {
        account: { type: "CREDIT_CARD" },
        transactionInvoice: { invoice: { dueDate: range } },
      },
    ],
  };
}
