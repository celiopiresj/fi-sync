import { parseCalendarDate } from "@/lib/date";

// Months here are "yyyy-MM" keys — an invoice's due month, which is what
// "quando eu preciso pagar" is grouped by (same choice as the invoices
// screen's own period stepper).

export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const total = year! * 12 + (month! - 1) + delta;
  const shiftedYear = Math.floor(total / 12);
  const shiftedMonth = ((total % 12) + 12) % 12;
  return `${shiftedYear}-${String(shiftedMonth + 1).padStart(2, "0")}`;
}

// A real instant for next-intl's dateTime formatter — the 1st, pinned to
// APP_TIME_ZONE (the formatter's own zone), so the label never drifts to
// the previous month whatever the browser's zone is.
export function monthKeyToDate(monthKey: string): Date {
  return parseCalendarDate(`${monthKey}-01`);
}
