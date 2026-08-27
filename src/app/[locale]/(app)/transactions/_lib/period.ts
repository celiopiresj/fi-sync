import { toAppZoned } from "@/lib/date";

// A calendar month, independent of any single day within it — what the
// header's period stepper steps through (tasks/xxx, transactions screen
// redesign). `month` is 0-indexed, same convention as `Date#getMonth`,
// so it plugs directly into `Date`/`format.dateTime` without a +1/-1
// translation at every call site.
export type Period = { year: number; month: number };

// "Right now"'s period, read from APP_TIME_ZONE's wall-clock digits (not
// the runtime's own zone — see src/lib/date.ts) so the stepper opens on
// the correct month regardless of where the server/browser happens to be.
export function currentPeriod(): Period {
  const zoned = toAppZoned(new Date());
  return { year: zoned.getFullYear(), month: zoned.getMonth() };
}

// Steps a period by `delta` months (negative to go back). Plain integer
// math on (year, month) — not a real instant, so unlike date-fns calls
// elsewhere in this app it doesn't need App-timezone handling; a month
// index doesn't shift depending on timezone the way a specific moment
// does.
export function shiftPeriod(period: Period, delta: number): Period {
  const total = period.year * 12 + period.month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// First/last day of the period as "yyyy-MM-dd" strings, ready to hand to
// `listTransactions`'s `from`/`to` filters (which already run them
// through `parseCalendarDate` — see actions.ts). The last-day lookup
// (`new Date(year, month + 1, 0)`, the standard "day 0 of next month"
// trick) is pure Gregorian day-count arithmetic — how many days a given
// month has isn't timezone-dependent, so this is safe without going
// through toAppZoned/fromAppZoned the way a real instant would need.
export function periodRange(period: Period): { from: string; to: string } {
  const lastDay = new Date(period.year, period.month + 1, 0).getDate();
  const monthStr = pad2(period.month + 1);
  return {
    from: `${period.year}-${monthStr}-01`,
    to: `${period.year}-${monthStr}-${pad2(lastDay)}`,
  };
}

export function periodsEqual(a: Period, b: Period): boolean {
  return a.year === b.year && a.month === b.month;
}

// Parses a "yyyy-MM" period key (the projections screen's "Ver extrato"
// link — src/app/[locale]/(app)/projections — passes one via the
// `?month=` query param so the transactions screen opens already
// scoped to that month) back into a Period. Returns null for anything
// missing or malformed, so callers fall back to currentPeriod().
export function parsePeriodKey(value: string | null | undefined): Period | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { year, month };
}
