"use client";

import { useQuery } from "@tanstack/react-query";
import { getTransactionFormOptions } from "@/app/[locale]/(app)/transactions/actions";

const QUICK_ADD_OPTIONS_KEY = ["quick-add-transaction-options"] as const;

// Backs the FAB's "nova transação" drawer (mobile-nav-shell.tsx), which
// mounts once at the app shell and can open from any route — unlike
// /transactions' own useTransactionFormOptions (_hooks/), there's no
// server-rendered initialData to seed here, so this only fetches while
// the drawer is actually open (`enabled`).
export function useQuickAddTransactionOptions(enabled: boolean) {
  return useQuery({
    queryKey: QUICK_ADD_OPTIONS_KEY,
    queryFn: () => getTransactionFormOptions(),
    enabled,
  });
}
