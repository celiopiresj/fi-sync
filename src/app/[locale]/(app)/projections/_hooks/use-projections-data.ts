"use client";

import { useQuery } from "@tanstack/react-query";
import { getProjections } from "../actions";
import type { ProjectionEntry } from "../_types/types";

// Owns the `["projections", monthsAhead]` query so ProjectionsView stays
// declarative (AGENTS.md) — same split as every other route's own
// use-*-data.ts. `initialData` is only trusted when `monthsAhead`
// matches whatever page.tsx fetched server-side for its own SSR
// render — otherwise (the period selector picked a different horizon)
// a real fetch is needed.
export function useProjectionsData(
  monthsAhead: number,
  initialProjections: ProjectionEntry[],
  isDefault: boolean,
) {
  const { data } = useQuery({
    queryKey: ["projections", monthsAhead],
    queryFn: () => getProjections(monthsAhead),
    initialData: isDefault ? initialProjections : undefined,
  });

  return { projections: data ?? [] };
}
