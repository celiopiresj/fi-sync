"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTransactionFormOptions } from "../actions";
import type { PersonOption } from "../_types/types";

// Single source of truth for the `transaction-form-options` query key —
// both hooks below key off this constant instead of repeating the
// string, so a typo in one can't silently break the other's
// invalidation.
const TRANSACTION_FORM_OPTIONS_KEY = ["transaction-form-options"] as const;

// Re-fetchable so a person created inline from the transaction form's
// Pessoa field (single mode) or Pessoa chip (batch mode) shows up in the
// picker without a full page reload — see useInvalidateTransactionFormOptions
// below, called from CreatePersonInline on success. `defaultPersonId`
// rides along on the same query (it's derived from the same
// People/splits data, see computeDefaultPersonId in actions.ts) so a
// freshly-created person can also become tomorrow's default without a
// reload. `.accounts`/`.categories` still come from the static
// server-rendered props in TransactionsView, since nothing creates those
// inline (yet).
export function useTransactionFormOptions(
  initialPeople: PersonOption[],
  initialDefaultPersonId: string | null,
) {
  const { data } = useQuery({
    queryKey: TRANSACTION_FORM_OPTIONS_KEY,
    queryFn: () =>
      getTransactionFormOptions().then((options) => ({
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
// TransactionForm/BatchTransactionTable) doesn't also have to run the
// full query or supply `initialData` it doesn't have.
export function useInvalidateTransactionFormOptions() {
  const queryClient = useQueryClient();
  return function invalidateFormOptions() {
    queryClient.invalidateQueries({ queryKey: TRANSACTION_FORM_OPTIONS_KEY });
  };
}
