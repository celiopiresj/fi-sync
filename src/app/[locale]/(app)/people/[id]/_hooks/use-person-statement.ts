"use client";

import { useQuery } from "@tanstack/react-query";
import { getPersonStatement } from "../../actions";
import type { PersonStatement, StatementPeriod } from "../_types/types";

export function usePersonStatement(
  personId: string,
  period: StatementPeriod,
  initialStatement: PersonStatement,
  // `initialStatement` was only ever fetched for the period the page
  // first rendered with — seeding every later period's own query key
  // with that same stale object (as an unconditional `initialData`
  // would) shows the WRONG month's numbers for a moment after the
  // period stepper changes `period`, before the real fetch for that new
  // key resolves and overwrites it. Same `useInitialData`/
  // `isDefaultFilters` gating as useInvoicesData's own.
  useInitialData: boolean,
) {
  return useQuery({
    queryKey: ["person-statement", personId, period] as const,
    queryFn: () => getPersonStatement(personId, period),
    initialData: useInitialData ? initialStatement : undefined,
  });
}
