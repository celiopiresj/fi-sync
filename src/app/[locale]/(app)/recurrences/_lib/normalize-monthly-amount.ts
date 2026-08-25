import type { RecurrenceFrequencyValue } from "../_schema/schema";

// Average occurrences per calendar month for each frequency — used to
// normalize a DAILY/WEEKLY amount to a monthly-equivalent figure for the
// summary cards' "Impacto Mensal Fixo" (tasks/012.md's third Open
// Question). Average, not a specific month's real day/week count,
// because the cards summarize a standing rule, not one particular month
// — the same reasoning applies to a WEEKLY rule (which lands on 4 or 5
// dates depending on the month) as to a DAILY one.
const WEEKS_PER_MONTH = 52 / 12; // ≈ 4.3333
const DAYS_PER_MONTH = 365.25 / 12; // ≈ 30.4375, leap-year-aware

// Converts one recurrence's per-occurrence `amount` into its
// monthly-equivalent value — e.g. a WEEKLY R$50 rule becomes
// ≈R$216,67/month, a DAILY R$10 rule becomes ≈R$304,38/month. Sign is
// preserved (income stays positive, expense stays negative), so callers
// can sum the result directly the same way SummaryCards' own
// sumIncomeExpenses does for transactions.
export function normalizeToMonthly(
  amount: number,
  frequency: RecurrenceFrequencyValue,
): number {
  switch (frequency) {
    case "DAILY":
      return amount * DAYS_PER_MONTH;
    case "WEEKLY":
      return amount * WEEKS_PER_MONTH;
    case "MONTHLY":
      return amount;
  }
}
