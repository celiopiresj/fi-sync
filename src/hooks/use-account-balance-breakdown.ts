"use client";

import { useQuery } from "@tanstack/react-query";
import { getAccountBalanceBreakdown } from "@/app/[locale]/(app)/transactions/actions";

// Backs the transfer form's balance figures: how much the chosen source
// account holds and whose it is — the balance target's preview, and the
// typed targets' "saldo atual" line. Only fetches once an account is
// picked (and `enabled` allows it).
//
// Shared-hooks folder rather than a route's own `_hooks/` because the
// form behind it is mounted from three places (the FAB, /transactions and
// /accounts/[id]) — same reasoning as the other quick-add hooks here.
export function useAccountBalanceBreakdown(accountId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["account-balance-breakdown", accountId],
    queryFn: () => getAccountBalanceBreakdown(accountId),
    enabled: enabled && Boolean(accountId),
  });
}
