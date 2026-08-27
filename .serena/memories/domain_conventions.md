# Domain Invariants (money, dates, sign convention)

These are silent-failure-prone — violating them produces wrong numbers/dates
without a type error. All stated explicitly in AGENTS.md; repeated here as
the highest-value quick-reference.

## Money
- Always `Decimal` (`@db.Decimal(12,2)`) in Prisma, never `Float`.
- Sign convention: positive = income, negative = expense. A transfer is two
  Transaction rows (one negative/source, one positive/destination) sharing
  `transferGroupId`, not a separate type/table.
- Any arithmetic beyond storing/reading a single value (sign flips, summing
  splits, dividing an installment total, comparing amounts) should use
  dinero.js, not raw `number` +/-/*//. In practice several existing screens
  (e.g. transactions summary cards) already do plain `number` math on
  pre-`.toNumber()`'d values — this is pre-existing debt, not a pattern to
  copy into new code.
- Convert Decimal↔number only at the Prisma read/write boundary
  (`.toNumber()` on read, plain number on write) — this includes DB-side
  sums via `prisma.*.aggregate`/`groupBy` `_sum`, which is the established
  pattern for "sum many rows" (see `getMonthlyBalances`,
  `getPersonStatement`) rather than pulling rows to sum in JS.

## Dates
- `APP_TIME_ZONE = "America/Sao_Paulo"` (`src/lib/date.ts`), fixed regardless
  of server runtime timezone (often UTC on serverless).
- Three distinct cases, each with its own helper — mixing them up was a real
  shipped bug (transaction date column + invoice-cycle calc both off by a
  day in timezones behind UTC):
  1. Parsing a date-only string (form input, filter param) →
     `parseCalendarDate`, never `new Date(str)`.
  2. date-fns arithmetic (`addDays`/`setDate`/...) on such a value → wrap in
     `toAppZoned(...)`, do the math, unwrap with `fromAppZoned(...)`.
  3. Reading a value already stored in a `@db.Date` column (Transaction.date,
     Invoice.closingDate/dueDate, ...) → Postgres DATE has no time-of-day;
     Prisma returns UTC midnight for it. Format with `DATE_ONLY_FORMAT_OPTIONS`
     (`timeZone: "UTC"`) or `dateOnlyKey`, NEVER through `APP_TIME_ZONE` —
     doing so rolls it back a calendar day in zones behind UTC.
- A calendar-widget round-trip (react-day-picker) is a fourth, separate case —
  `parseLocalCalendarDate`/`formatLocalCalendarDate`, browser-local, no zone
  pinning at all.
- Display formatting gets `timeZone: APP_TIME_ZONE` for free from the global
  next-intl config (`src/i18n/request.ts`) — don't pass a one-off `timeZone`
  at call sites for real instants (only case 3 above needs an explicit
  override, to "UTC").

## i18n (see `mem:i18n_conventions` for the full key-naming rule)
- Zero hardcoded UI strings, zero "default" fallback literals — everything
  through `useTranslations`/`getTranslations`, keys added to BOTH `pt-BR` and
  `en` JSON before being referenced in code (a missing key hard-crashes dev).
