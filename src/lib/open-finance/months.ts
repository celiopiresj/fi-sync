// Month buckets for the Open Finance preview. Every value here is a plain
// calendar string ("YYYY-MM" / "YYYY-MM-DD") handled with integer math, so
// the result never depends on the runtime's timezone. "Today" comes from
// `todayCalendarDate()` (APP_TIME_ZONE) at the call site.
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function monthOf(date: string) {
  return date.slice(0, 7);
}

export function shiftMonth(month: string, delta: number) {
  const [year, value] = month.split("-").map(Number);
  const total = year * 12 + (value - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function daysInMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  if (value === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(value) ? 30 : 31;
}

// Months the owner can browse, newest first: from the import start date up
// to the current month. Credit cards also include the next month, where
// future installments already announced by the bank are dated.
export function importMonths(fromDate: string, today: string, type: string) {
  const first = monthOf(fromDate);
  const last = shiftMonth(monthOf(today), type === "CREDIT" ? 1 : 0);
  const months: string[] = [];
  for (let month = last; month >= first; month = shiftMonth(month, -1)) months.push(month);
  return months.length > 0 ? months : [first];
}

// The provider date filter for one month, never earlier than the import
// start date. Both bounds are inclusive (Pluggy `dateFrom`/`dateTo`).
export function monthRange(month: string, fromDate: string) {
  const start = `${month}-01`;
  return { dateFrom: start < fromDate ? fromDate : start, dateTo: `${month}-${String(daysInMonth(month)).padStart(2, "0")}` };
}
