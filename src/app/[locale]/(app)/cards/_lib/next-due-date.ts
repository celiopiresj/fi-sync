import { addMonths, differenceInCalendarDays, setDate } from "date-fns";
import { toAppZoned } from "@/lib/date";

// Same setDate/addMonths "find the next occurrence of this day-of-month"
// pattern as computeInvoiceCycle (src/lib/invoice-resolution.ts), run
// against toAppZoned so "today" and dueDay always compare in
// APP_TIME_ZONE rather than the server process's own zone. Both `due`
// and `zonedFrom` stay in that same zoned representation for the
// subtraction below — no need to convert back to a real UTC instant for
// a pure day count.
export function daysUntilDue(dueDay: number, fromDate: Date): number {
  const zonedFrom = toAppZoned(fromDate);
  let due = setDate(zonedFrom, dueDay);
  if (due < zonedFrom) {
    due = addMonths(due, 1);
  }
  return differenceInCalendarDays(due, zonedFrom);
}
