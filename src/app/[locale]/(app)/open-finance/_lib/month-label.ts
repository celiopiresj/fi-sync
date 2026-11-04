import { parseCalendarDate, todayCalendarDate } from "@/lib/date";
import { monthOf } from "@/lib/open-finance/months";

// Month tabs show only the month name inside the current year and add the
// year otherwise ("dezembro de 2025"), so long histories stay unambiguous.
// Months after the current one (card installments) are flagged as future.
export function monthLabelParts(month: string) {
  const today = todayCalendarDate();
  const sameYear = month.slice(0, 4) === today.slice(0, 4);
  return {
    date: parseCalendarDate(`${month}-01`),
    options: sameYear ? { month: "long" as const } : { month: "long" as const, year: "numeric" as const },
    future: month > monthOf(today),
  };
}
