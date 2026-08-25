import type { useFormatter } from "next-intl";
import { todayCalendarDate } from "@/lib/date";

// Pure "yyyy-MM-dd" + delta arithmetic, built and read back entirely
// through the runtime's own local Date getters/setters (never
// serialized through toISOString/UTC in between) — self-consistent
// regardless of which zone the runtime happens to be in, same reasoning
// as the last-day-of-month trick in _lib/period.ts. Overflow (day 0,
// day 32) normalizes automatically via the Date constructor.
function addCalendarDays(dateKey: string, delta: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(year, month - 1, day + delta);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const d = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isToday(dateKey: string): boolean {
  return dateKey === todayCalendarDate();
}

function isYesterday(dateKey: string): boolean {
  return dateKey === addCalendarDays(todayCalendarDate(), -1);
}

// Intl's pt-BR long weekday includes a "-feira" suffix ("terça-feira")
// and follows the locale's running-text convention of lowercasing it —
// the design wants just the bare, capitalized name ("Terça"). English's
// long weekday has neither trait, so the regex/capitalize below are
// no-ops for it and this one function safely serves both locales.
function shortenWeekday(weekdayLong: string): string {
  const stripped = weekdayLong.replace(/-feira$/i, "");
  return stripped.charAt(0).toLocaleUpperCase("pt-BR") + stripped.slice(1);
}

// Pre-bound per-key callbacks rather than the raw `t` function itself —
// each call site below invokes its own translator with a literal key
// (`t("group.today", ...)`), which is what actually needs to type-check
// against next-intl's message keys. Accepting the whole `t` function
// here instead would mean re-declaring its key parameter's type by
// hand, and that hand-rolled type has no reliable way to match
// next-intl's own (which may or may not be narrowed to this project's
// actual message keys depending on its typed-messages setup).
type GroupDateTranslations = {
  today: (date: string) => string;
  yesterday: (date: string) => string;
  dateHeader: (weekday: string, date: string) => string;
};

// Shared by the desktop group header (transactions-view.tsx) and the
// mobile card list (transaction-mobile-list.tsx) so the BUG-fix date
// wording (tasks/xxx, section 5) can't drift between the two. `dateKey`
// is a `dateOnlyKey(transaction.date)` output (UTC-encoded, see
// src/lib/date.ts) — every `format.dateTime` call below passes
// `timeZone: "UTC"` for that reason, same as this screen's other
// @db.Date-sourced formatting (DATE_ONLY_FORMAT_OPTIONS).
export function formatGroupDateHeader(
  dateKey: string,
  translate: GroupDateTranslations,
  format: ReturnType<typeof useFormatter>,
): string {
  const date = new Date(dateKey);

  if (isToday(dateKey)) {
    return translate.today(
      format.dateTime(date, { day: "numeric", month: "long", timeZone: "UTC" }),
    );
  }
  if (isYesterday(dateKey)) {
    return translate.yesterday(
      format.dateTime(date, { day: "numeric", month: "long", timeZone: "UTC" }),
    );
  }
  const weekday = shortenWeekday(
    format.dateTime(date, { weekday: "long", timeZone: "UTC" }),
  );
  return translate.dateHeader(
    weekday,
    format.dateTime(date, { day: "numeric", month: "long", timeZone: "UTC" }),
  );
}
