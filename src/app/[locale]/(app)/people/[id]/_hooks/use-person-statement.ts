"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["person-statement", personId, period] as const,
    queryFn: () => getPersonStatement(personId, period),
    initialData: useInitialData ? initialStatement : undefined,
  });

  // Broad prefix (every period, not just this one) — same convention as
  // useInvoicesData's own invalidate, so creating/editing a transaction
  // from this page can't leave a stale figure behind if the user then
  // steps to a different month.
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["person-statement"] });
  }, [queryClient]);

  return { ...query, invalidate };
}
