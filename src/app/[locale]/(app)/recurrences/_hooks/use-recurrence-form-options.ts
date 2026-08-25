"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRecurrenceFormOptions } from "../actions";
import type { PersonOption } from "../_types/types";

// Single source of truth for the `recurrence-form-options` query key —
// both hooks below key off this constant instead of repeating the
// string, so a typo in one can't silently break the other's
// invalidation. Mirrors transactions' own use-transaction-form-options.ts
// field-for-field (see the comment there on why THIS narrow a query —
// only `people`/`defaultPersonId`, never `accounts`/`categories` — is
// exactly what avoided the implicit-any bug an earlier, broader version
// of this hook hit).
const RECURRENCE_FORM_OPTIONS_KEY = ["recurrence-form-options"] as const;

// Re-fetchable so a person created inline from the recurrence form's
// Pessoa field or its "dividir" section's Deve list shows up in the
// picker without a full page reload — see
// useInvalidateRecurrenceFormOptions below, called from
// CreatePersonInline on success. `defaultPersonId` rides along on the
// same query (derived from the same People/TransactionSplit data — see
// computeDefaultPersonId in actions.ts) so a freshly-created person can
// also become tomorrow's default without a reload. `.accounts`/
// `.categories` still come from the static server-rendered props in
// RecurrencesView, since nothing creates those inline.
export function useRecurrenceFormOptions(
  initialPeople: PersonOption[],
  initialDefaultPersonId: string | null,
) {
  const { data } = useQuery({
    queryKey: RECURRENCE_FORM_OPTIONS_KEY,
    queryFn: () =>
      getRecurrenceFormOptions().then((options) => ({
        people: options.people,
        defaultPersonId: options.defaultPersonId,
      })),
    initialData: {
      people: initialPeople,
      defaultPersonId: initialDefaultPersonId,
    },
  });

  return { people: data.people, defaultPersonId: data.defaultPersonId };
}

// Split out from the hook above so a component that only needs to
// trigger a refetch (CreatePersonInline, nested deep under
// RecurrenceCreateForm/RecurrenceEditForm) doesn't also have to run the
// full query or supply `initialData` it doesn't have.
export function useInvalidateRecurrenceFormOptions() {
  const queryClient = useQueryClient();
  return function invalidateFormOptions() {
    queryClient.invalidateQueries({ queryKey: RECURRENCE_FORM_OPTIONS_KEY });
  };
}
