import { parseCalendarDate, todayCalendarDate } from "@/lib/date";
import type { InvoicePeriod } from "../_types/types";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// First/last calendar day of `period`'s month as real instants (pinned
// to APP_TIME_ZONE via parseCalendarDate) — used to scope listInvoices'
// dueDate filter to the period the header stepper is showing. Scoped by
// due date, not closing date: an invoice that closes in August but is
// due in September should show up under "Setembro", since "quando eu
// preciso pagar" is what the month stepper is meant to answer.
export function invoicePeriodRange(period: InvoicePeriod): {
  from: Date;
  to: Date;
} {
  const lastDay = new Date(period.year, period.month + 1, 0).getDate();
  return {
    from: parseCalendarDate(`${period.year}-${pad2(period.month + 1)}-01`),
    to: parseCalendarDate(
      `${period.year}-${pad2(period.month + 1)}-${pad2(lastDay)}`,
    ),
  };
}

export function currentInvoicePeriod(): InvoicePeriod {
  const [year, month] = todayCalendarDate().split("-").map(Number);
  return { year, month: month - 1 };
}

export function shiftInvoicePeriod(
  period: InvoicePeriod,
  delta: number,
): InvoicePeriod {
  const total = period.year * 12 + period.month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function invoicePeriodsEqual(a: InvoicePeriod, b: InvoicePeriod): boolean {
  return a.year === b.year && a.month === b.month;
}
