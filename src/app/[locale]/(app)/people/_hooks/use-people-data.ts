"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listPeople } from "../actions";
import type { PersonRow } from "../_types/types";

// Owns the `["people"]` query and its invalidation so PeopleView itself
// stays declarative (see "Screens and components stay declarative" in
// AGENTS.md).
export function usePeopleData(initialPeople: PersonRow[]) {
  const queryClient = useQueryClient();

  const { data: people = initialPeople } = useQuery({
    queryKey: ["people"],
    queryFn: () => listPeople(),
    initialData: initialPeople,
  });

  function invalidatePeople() {
    queryClient.invalidateQueries({ queryKey: ["people"] });
  }

  return { people, invalidatePeople };
}
