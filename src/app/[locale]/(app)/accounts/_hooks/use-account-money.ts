"use client";

import { useFormatter } from "next-intl";
import { useBalanceVisibility } from "@/hooks/use-balance-visibility";

// BRL formatter shared by the list and detail screens, respecting global
// balance privacy masking (`•••••`) when toggled off.
export function useAccountMoney() {
  const format = useFormatter();
  const { balancesVisible } = useBalanceVisibility();
  return (value: number) =>
    balancesVisible
      ? format.number(value, { style: "currency", currency: "BRL" })
      : "•••••";
}
