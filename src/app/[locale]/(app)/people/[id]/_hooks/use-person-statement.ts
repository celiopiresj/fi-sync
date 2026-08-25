"use client";

import { useQuery } from "@tanstack/react-query";
import { getPersonStatement } from "../../actions";
import type { PersonStatement, StatementPeriod } from "../_types/types";

export function usePersonStatement(
  personId: string,
  period: StatementPeriod,
  initialStatement: PersonStatement,
) {
  return useQuery({
    queryKey: ["person-statement", personId, period] as const,
    queryFn: () => getPersonStatement(personId, period),
    initialData: initialStatement,
  });
}
