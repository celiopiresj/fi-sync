import { BRL, dinero, subtract, toDecimal } from "dinero.js";
import type { KpiTone } from "@/components/screen/kpi-card";

function toDinero(value: number) {
  return dinero({ amount: Math.round(value * 100), currency: BRL });
}

// What is left in the accounts once every invoice awaiting payment is
// settled, the number people actually plan the month with.
export function availableAfterInvoices(totalBalance: number, invoicesDue: number): number {
  return Number(toDecimal(subtract(toDinero(totalBalance), toDinero(invoicesDue))));
}

// Share of the month's income already spent (1 = everything that came
// in). Null when nothing came in, since a ratio would be meaningless.
export function spentShareOfIncome(income: number, expenses: number): number | null {
  return income > 0 ? expenses / income : null;
}

export function spentShareTone(share: number | null): KpiTone {
  if (share === null) return "default";
  if (share > 1) return "negative";
  if (share > 0.8) return "warning";
  return "positive";
}

// Bar width in percent, capped so overspending fills the track instead
// of overflowing it.
export function shareBarWidth(share: number | null): string {
  return `${Math.min(share ?? 0, 1) * 100}%`;
}

// Share of a card's limit in use. Null when the card has no limit set.
export function cardUsageShare(used: number, limit: number): number | null {
  return limit > 0 ? used / limit : null;
}

// Same tiers the app uses for card limits elsewhere: under 70% is fine,
// 70-94% needs attention, 95% and up is critical.
export function cardUsageTone(share: number | null): KpiTone {
  if (share === null) return "default";
  if (share >= 0.95) return "negative";
  if (share >= 0.7) return "warning";
  return "positive";
}
