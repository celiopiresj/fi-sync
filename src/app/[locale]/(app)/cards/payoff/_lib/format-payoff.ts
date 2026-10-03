import type { useFormatter } from "next-intl";
import { capitalizeFirst } from "@/lib/capitalize-first";
import { monthKeyToDate } from "./payoff-month";

type Formatter = ReturnType<typeof useFormatter>;

export function formatMoney(format: Formatter, value: number): string {
  return format.number(value, { style: "currency", currency: "BRL" });
}

// "Dez/26"-style — the same short month label the projections screen
// uses (capitalizeFirst, not the `capitalize` class: see PeriodStepper).
export function formatMonthShort(format: Formatter, monthKey: string): string {
  return capitalizeFirst(
    format.dateTime(monthKeyToDate(monthKey), { month: "short", year: "2-digit" }),
  );
}

export function formatMonthLong(format: Formatter, monthKey: string): string {
  return capitalizeFirst(
    format.dateTime(monthKeyToDate(monthKey), { month: "long", year: "numeric" }),
  );
}
