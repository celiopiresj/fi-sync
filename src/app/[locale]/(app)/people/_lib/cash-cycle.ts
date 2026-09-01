import { parseCalendarDate, todayCalendarDate } from "@/lib/date";
import type { StatementPeriod } from "../_types/types";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export type CashCycle = { start: Date; end: Date; isOpen: boolean };

// Cash movements (non credit-card) on the person detail page (people/[id])
// are grouped into a fixed statement cycle running the 20th of the month
// before `period` through the 19th of `period`'s own month — independent
// of any card's own due day (card items keep using the real
// Invoice.dueDate per account instead, see getPersonStatement in
// actions.ts). `end` is capped at "today" while the cycle is still
// running, so a still-open cycle only shows what's actually happened so
// far rather than a range reaching into the future. "Today" is read from
// APP_TIME_ZONE (see src/lib/date.ts), not the server process's own
// timezone.
export function getCashCycle(period: StatementPeriod): CashCycle {
  const prevMonth = period.month === 0 ? 11 : period.month - 1;
  const prevYear = period.month === 0 ? period.year - 1 : period.year;

  const start = parseCalendarDate(`${prevYear}-${pad2(prevMonth + 1)}-20`);
  const nominalEnd = parseCalendarDate(
    `${period.year}-${pad2(period.month + 1)}-19`,
  );
  const today = parseCalendarDate(todayCalendarDate());
  const isOpen = today < nominalEnd;

  return { start, end: isOpen ? today : nominalEnd, isOpen };
}

export function currentStatementPeriod(): StatementPeriod {
  const [year, month] = todayCalendarDate().split("-").map(Number);
  return { year, month: month - 1 };
}

export function shiftStatementPeriod(
  period: StatementPeriod,
  delta: number,
): StatementPeriod {
  const total = period.year * 12 + period.month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

// First/last calendar day of `period`'s month as Dates — used to match a
// credit-card account's Invoice.dueDate to the selected period (each
// card's own due day, not the 20-19 cash cycle above — and not
// closingDate either, see getPersonStatement's own comment on why).
export function periodMonthRange(period: StatementPeriod): {
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
