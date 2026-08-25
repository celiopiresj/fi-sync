"use client";

import { useQuery } from "@tanstack/react-query";
import { getMonthlyBalances } from "../actions";
import type { Period } from "../_lib/period";

// Keyed on accountId + period — see getMonthlyBalances in actions.ts for
// why every OTHER filter (search, category, type) is ignored; period
// itself is very much not ignored, it's the chart's anchor month, so a
// stepper move must trigger a refetch centered on the new month.
export function useMonthlyBalances(accountId: string | undefined, period: Period) {
  return useQuery({
    queryKey: ["monthly-balances", accountId, period] as const,
    queryFn: () => getMonthlyBalances(period, accountId),
  });
}
