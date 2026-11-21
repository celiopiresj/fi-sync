"use client";

import { useFormatter } from "next-intl";
import { useBalanceVisibility } from "@/hooks/use-balance-visibility";

export function useCardMoney() {
  const format = useFormatter();
  const { balancesVisible } = useBalanceVisibility();
  return (value: number) =>
    balancesVisible
      ? format.number(value, { style: "currency", currency: "BRL" })
      : "•••••";
}
