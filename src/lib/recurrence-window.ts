import { addDays, addMonths, addWeeks } from "date-fns";
import { fromAppZoned, toAppZoned } from "@/lib/date";

export const recurrenceFrequencyValues = ["none", "daily", "weekly", "monthly"] as const;
export type RecurrenceFrequencyOption = (typeof recurrenceFrequencyValues)[number];

// Mirrors recurrences/actions.ts's own GENERATION_WINDOW_MONTHS — a
// recurrence started anywhere else (the transactions screen, the Telegram
// bot) must behave identically to one created from /recurrences (same
// rolling-window generation, so it shows up as "active" in
// listRecurrences and supports the same extendRecurrenceGeneration flow)
// rather than a separate "repeat N times and then silently stop"
// shortcut.
export const RECURRENCE_GENERATION_WINDOW_MONTHS = 12;

export function stepDate(date: Date, frequency: RecurrenceFrequencyOption) {
  if (frequency === "none") return date;
  // Do the arithmetic on the App-timezone wall-clock digits, not the
  // server process's own timezone — see src/lib/date.ts.
  const zoned = toAppZoned(date);
  switch (frequency) {
    case "daily":
      return fromAppZoned(addDays(zoned, 1));
    case "weekly":
      return fromAppZoned(addWeeks(zoned, 1));
    case "monthly":
      return fromAppZoned(addMonths(zoned, 1));
  }
}

// The last date a freshly created recurrence generates an occurrence for
// — `startDate` plus the rolling window, on APP_TIME_ZONE's calendar.
export function recurrenceWindowEnd(startDate: Date): Date {
  return fromAppZoned(
    addMonths(toAppZoned(startDate), RECURRENCE_GENERATION_WINDOW_MONTHS),
  );
}
