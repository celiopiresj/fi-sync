import type { BalanceStatus } from "../_types/types";

// Money in / money out colouring for a person's balance, always paired
// with the signed amount and the status badge's label (never colour alone).
export const BALANCE_STATUS_TEXT: Record<BalanceStatus, string> = {
  toReceive: "text-positive",
  toPay: "text-negative",
  settled: "text-foreground",
};

export const BALANCE_STATUS_BADGE: Record<BalanceStatus, string> = {
  toReceive: "border-positive/30 bg-positive/10 text-positive",
  toPay: "border-negative/30 bg-negative/10 text-negative",
  settled: "border-border bg-muted text-muted-foreground",
};

export const BALANCE_STATUS_FILTERS = [
  "all",
  "toReceive",
  "toPay",
  "settled",
] as const;
