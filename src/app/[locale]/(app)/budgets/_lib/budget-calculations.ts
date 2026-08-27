import { add, BRL, dinero, toDecimal } from "dinero.js";
import {
  PROGRESS_THRESHOLDS,
  type ThresholdColor,
} from "../_constants/constants";

// Sums already-known numeric amounts (e.g. Budget/BudgetItem values read
// back from Prisma) through dinero.js rather than plain `+` — AGENTS.md's
// "Money values" convention. Unlike computeBudgetAllocation in
// budget-allocation.ts (which parses live-typed form strings), these are
// exact numbers already, so amount is derived with Math.round(v * 100)
// instead of the permissive string-parsing grammar used there.
export function sumAmounts(values: number[]): number {
  const total = values.reduce(
    (sum, value) =>
      add(sum, dinero({ amount: Math.round(value * 100), currency: BRL })),
    dinero({ amount: 0, currency: BRL }),
  );
  return Number(toDecimal(total));
}

// Returns the threshold color tier for a given spending percentage.
export function thresholdColorForPercentage(
  percentage: number,
): ThresholdColor {
  for (const tier of PROGRESS_THRESHOLDS) {
    if (percentage <= tier.max) return tier.color;
  }
  return "negative";
}

// Clamp a percentage to [0, 100] for rendering a progress bar width —
// the bar itself caps at 100% even when spending exceeds the limit; the
// red color + "over budget" label communicates the overshoot.
export function clampPercentage(percentage: number): number {
  return Math.min(Math.max(percentage, 0), 100);
}
