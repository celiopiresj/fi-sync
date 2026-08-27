// A calendar month, independent of any single day within it — same
// {year, month} (0-indexed) shape as transactions/_lib/period.ts's own
// Period, duplicated here rather than cross-imported per this app's
// per-route self-containment convention (see e.g. invoices/actions.ts's
// own comment on the same choice).
export type ProjectionMonth = { year: number; month: number };

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// "yyyy-MM" — the key every bucket in actions.ts's getProjections is
// grouped by, and the same format the transactions screen's `?month=`
// query param (parsePeriodKey) expects.
export function monthKey(month: ProjectionMonth): string {
  return `${month.year}-${pad2(month.month + 1)}`;
}

export function addMonths(month: ProjectionMonth, delta: number): ProjectionMonth {
  const total = month.year * 12 + month.month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

// First/last day of the month as "yyyy-MM-dd" strings, ready for
// parseCalendarDate — the last-day lookup is the same timezone-safe
// "day 0 of next month" trick transactions/_lib/period.ts's own
// periodRange uses (pure calendar math, not a real instant, so it
// doesn't need APP_TIME_ZONE handling).
export function monthFirstDay(month: ProjectionMonth): string {
  return `${month.year}-${pad2(month.month + 1)}-01`;
}

export function monthLastDay(month: ProjectionMonth): string {
  const lastDay = new Date(month.year, month.month + 1, 0).getDate();
  return `${month.year}-${pad2(month.month + 1)}-${pad2(lastDay)}`;
}

// The inverse of monthKey — ProjectionCard needs a real Date to hand to
// next-intl's useFormatter().dateTime() for the localized "ago/26"-style
// label, not a hardcoded format string (AGENTS.md: no formatting logic
// that bypasses next-intl). Local-time Date (not parseCalendarDate) is
// fine here: this never leaves the browser or gets compared against a
// stored value, it only feeds a display formatter.
export function monthKeyToDate(key: string): Date {
  const [year, month] = key.split("-").map(Number);
  return new Date(year!, month! - 1, 1);
}
