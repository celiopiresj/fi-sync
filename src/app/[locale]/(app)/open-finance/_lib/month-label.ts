import { parseCalendarDate, todayCalendarDate } from "@/lib/date";

// Month tabs show only the month name inside the current year and add the
// year otherwise ("dezembro de 2025"), so long histories stay unambiguous.
export function monthLabelParts(month: string) {
  const sameYear = month.slice(0, 4) === todayCalendarDate().slice(0, 4);
  return {
    date: parseCalendarDate(`${month}-01`),
    options: sameYear ? { month: "long" as const } : { month: "long" as const, year: "numeric" as const },
  };
}
