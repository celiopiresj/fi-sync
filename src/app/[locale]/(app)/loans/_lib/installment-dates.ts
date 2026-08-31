import { addMonths, getDaysInMonth, setDate } from "date-fns";
import { toAppZoned, fromAppZoned } from "@/lib/date";

// Same overflow-into-next-month clamp as invoice-resolution.ts's own
// (module-private there, duplicated per this app's per-route
// self-containment convention — see AGENTS.md) — plain setDate
// overflows into the next month when `day` doesn't exist in this one
// (e.g. day 31 in a 30-day month); this clamps to that month's real
// last day instead.
function setDateClamped(date: Date, day: number): Date {
  return setDate(date, Math.min(day, getDaysInMonth(date)));
}

// Every installment lands on the SAME day-of-month as `firstDueDate`
// (the loan's own `dueDate`), one month apart — always derived from
// that original reference (`addMonths(zonedFirst, index)`), never
// compounding off an already-clamped previous installment's date, same
// anti-drift rule computeInvoiceCycle follows, needed so a due day near
// month-end resolves back to its real day once a shorter clamped month
// has passed.
//
// Pure date math, no DB dependency (unlike a credit card's cycle, which
// needs the account's own closingDay/dueDay) — safe to call from either
// the Server Action (actions.ts) or directly from the client form
// (loan-form.tsx's own past-installments preview), no server round-trip
// needed for either.
export function computeLoanInstallmentDates(
  firstDueDate: Date,
  installmentCount: number,
): Date[] {
  const zonedFirst = toAppZoned(firstDueDate);
  const targetDay = zonedFirst.getDate();

  return Array.from({ length: installmentCount }, (_, index) =>
    fromAppZoned(setDateClamped(addMonths(zonedFirst, index), targetDay)),
  );
}
