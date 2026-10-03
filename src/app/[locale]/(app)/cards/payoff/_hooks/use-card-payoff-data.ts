"use client";

import { useQuery } from "@tanstack/react-query";
import { getCardPayoff } from "../actions";
import type { CardPayoffFilters } from "../_schema/schema";
import type { CardPayoff } from "../_types/types";

// Owns the `["card-payoff", filters]` query so CardPayoffView stays
// declarative (AGENTS.md) — same split as every other route's own
// use-*-data.ts. `initialData` is only trusted for the filters page.tsx
// fetched with (none); any other combination is a real fetch, keeping
// the previous result on screen meanwhile instead of flashing back to
// the server-rendered one.
export function useCardPayoffData(
  filters: CardPayoffFilters,
  initialPayoff: CardPayoff,
  useInitialData: boolean,
) {
  const { data, isFetching } = useQuery({
    queryKey: ["card-payoff", filters],
    queryFn: () => getCardPayoff(filters),
    initialData: useInitialData ? initialPayoff : undefined,
    placeholderData: (previous) => previous,
  });

  return { payoff: data ?? initialPayoff, isFetching };
}
