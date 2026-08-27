import { fromZonedTime, toZonedTime } from "date-fns-tz";

// Every date-only value in the app (transaction date, invoice
// closing/due date, recurrence occurrences, installment dates) is a
// calendar day with no meaningful time-of-day. Two different concerns
// apply to these values, and they need opposite handling:
//
// 1. User input and date-fns *math* (`setDate`/`addDays`/`addWeeks`/
//    `addMonths`) on them — `parseCalendarDate`/`toAppZoned`/
//    `fromAppZoned` below still apply here. A date-only string like
//    "2026-11-05" has no timezone of its own; date-fns math reads/writes
//    a `Date` using whatever timezone the running process happens to be
//    in (the server's, which can be UTC on serverless and has nothing to
//    do with where Neon or the users are), so pinning every such value to
//    one fixed zone before doing arithmetic is what keeps "the 5th"
//    meaning the same calendar day regardless of where the code runs.
//    See AGENTS.md, "Date values".
//
// 2. Reading a value *already stored* in a `@db.Date` column (see the
//    fields' native type in prisma/schema.prisma — Transaction.date,
//    Invoice.closingDate/dueDate, Recurrence.startDate/endDate) is a
//    different situation: Postgres `DATE` has no time-of-day at all, and
//    Prisma always returns it as UTC midnight for that exact calendar day
//    — it isn't "midnight in some zone" the way a parsed/computed value
//    above is, it's just a bare date represented the only way a JS `Date`
//    can hold one. Formatting *that* through a fixed non-UTC zone (this
//    file's `APP_TIME_ZONE`, or any `Intl`/date-fns call using it) rolls
//    it back to the previous calendar day in any zone behind UTC —
//    confirmed Prisma behavior, see prisma/prisma#18257. Use
//    `dateOnlyKey` below, or pass `timeZone: "UTC"` explicitly, for
//    anything read back from one of these columns — never this file's
//    `APP_TIME_ZONE`.
export const APP_TIME_ZONE = "America/Sao_Paulo";

// Parses a date-only "YYYY-MM-DD" string (e.g. from an
// `<input type="date">`, or a filter param) as midnight of that calendar
// day in `APP_TIME_ZONE`, returning the UTC instant that represents. Use
// this instead of `new Date(dateOnlyString)` for every date coming from
// user input.
export function parseCalendarDate(value: string): Date {
  return fromZonedTime(value, APP_TIME_ZONE);
}

// Today's date as a "yyyy-MM-dd" string, from `APP_TIME_ZONE`'s
// wall-clock digits — not the server process's own timezone (which can
// already be tomorrow in UTC during Brazilian evening hours). Use this to
// default a date-only form field to "today" (its output is exactly what
// `parseCalendarDate` expects back). Not `dateOnlyKey`, which is for
// values already read from a `@db.Date` column, not a value to hand to a
// fresh input.
export function todayCalendarDate(): string {
  const zoned = toAppZoned(new Date());
  const year = zoned.getFullYear();
  const month = String(zoned.getMonth() + 1).padStart(2, "0");
  const day = String(zoned.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Converts a UTC instant to a `Date` whose plain getters/setters — and
// any date-fns function built on them, like `setDate`/`addDays`/
// `addWeeks`/`addMonths` — read and write `APP_TIME_ZONE`'s wall-clock
// digits instead of the runtime's own timezone. Always pair with
// `fromAppZoned` to convert the result back to a real instant before
// storing or returning it:
//
//   const zoned = toAppZoned(someDate);
//   const steppedZoned = addDays(zoned, 1);
//   const stepped = fromAppZoned(steppedZoned);
export function toAppZoned(date: Date): Date {
  return toZonedTime(date, APP_TIME_ZONE);
}

export function fromAppZoned(date: Date): Date {
  return fromZonedTime(date, APP_TIME_ZONE);
}

// A stable "yyyy-MM-dd" key for a value read back from a `@db.Date`
// column — safe to use for grouping/sorting/equality because it reads
// the UTC digits Prisma actually returns for these columns, not
// `APP_TIME_ZONE` (see the note above; using the app's zone here would
// roll the value back to the previous day).
export function dateOnlyKey(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

// A third case alongside the two in the file-level comment above: a
// date-only string a *calendar widget* (`<Calendar>`, react-day-picker)
// needs to show/edit as a `Date` object, with the round-trip staying
// inside the browser's own local zone the whole time — no instant, no
// fixed zone, no math. Neither `parseCalendarDate` (pins to
// APP_TIME_ZONE, for values headed to storage/math) nor `dateOnlyKey`
// (reads UTC digits, for values already read from a `@db.Date` column)
// is that: both would let the widget's day drift by one whenever the
// browser's zone disagrees with the one being pinned to. Used by
// PickerRowField's DatePickerRowField and BatchTransactionTable's Data
// chip (both under transactions/_components/form).
export function parseLocalCalendarDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

export function formatLocalCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Options for formatting a value read back from a `@db.Date` column with
// next-intl's `format.dateTime`/`useFormatter()` — always pass these
// (not the app's default zone) for Transaction.date, Invoice.
// closingDate/dueDate, Recurrence.startDate/endDate once they've been
// read from the database, for the same reason as `dateOnlyKey`.
export const DATE_ONLY_FORMAT_OPTIONS = {
  dateStyle: "short",
  timeZone: "UTC",
} as const;
