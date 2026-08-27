// Which "days until X" hint to show under an invoice card's item count
// (e.g. "Fecha em 5 dias" / "Vence hoje!" / "Venceu há 2 dias") — pure
// date-key arithmetic, no next-intl dependency, so the caller (which has
// useTranslations) maps the returned kind to a translated string. Dates
// come in as "yyyy-MM-dd" keys: `dateOnlyKey(invoice.closingDate/dueDate)`
// for the two @db.Date columns (never APP_TIME_ZONE-formatted — see
// src/lib/date.ts) and `todayCalendarDate()` for "today".
export type DueHint =
  | { kind: "paid" }
  | { kind: "closesToday" }
  | { kind: "closesInDays"; days: number }
  | { kind: "dueToday" }
  | { kind: "dueInDays"; days: number }
  | { kind: "overdueDays"; days: number };

function diffDays(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const fromUTC = Date.UTC(fy, fm - 1, fd);
  const toUTC = Date.UTC(ty, tm - 1, td);
  return Math.round((toUTC - fromUTC) / 86_400_000);
}

export function getDueHint(
  displayStatus: "OPEN" | "CLOSED" | "PARTIALLY_PAID" | "PAID",
  closingDateKey: string,
  dueDateKey: string,
  todayKey: string,
): DueHint {
  if (displayStatus === "PAID") return { kind: "paid" };

  if (displayStatus === "OPEN") {
    const days = diffDays(todayKey, closingDateKey);
    return days <= 0 ? { kind: "closesToday" } : { kind: "closesInDays", days };
  }

  // CLOSED or PARTIALLY_PAID — both still have a real due date pending,
  // just at different stages of being settled.
  const days = diffDays(todayKey, dueDateKey);
  if (days > 0) return { kind: "dueInDays", days };
  if (days === 0) return { kind: "dueToday" };
  return { kind: "overdueDays", days: Math.abs(days) };
}
