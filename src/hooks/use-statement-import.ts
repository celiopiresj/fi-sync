"use client";

import { useMutation } from "@tanstack/react-query";
import { importStatementFile } from "@/app/[locale]/(app)/transactions/actions";
import type { StatementSourceKind } from "@/lib/statement-import/schema";

// Reading the attached fatura/extrato — a mutation rather than a query
// because it's a one-shot upload with a side effect (an AI call that
// costs tokens), not something to cache or refetch. Nothing here
// invalidates: the action only READS the file and hands back rows, so
// the cache only changes later, when the reviewed rows are submitted
// through useQuickAddTransactionMutations' own batch calls.
//
// Lives next to the other two FAB hooks (use-quick-add-transaction-*)
// for the same reason they do: the drawer that uses it is mounted by the
// app shell, not by /transactions.
export function useStatementImport() {
  return useMutation({
    mutationFn: (input: { file: File; source: StatementSourceKind }) => {
      const formData = new FormData();
      formData.set("file", input.file);
      formData.set("source", input.source);
      return importStatementFile(formData);
    },
  });
}
