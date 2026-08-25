import { add, BRL, dinero, isNegative, subtract, toDecimal } from "dinero.js";

// Same comma-or-period decimal grammar as every route's own
// decimalString (schema.ts) — permissive here since this runs on every
// keystroke, before Zod has had a chance to validate the field; an
// unparsable/partial value just contributes 0 to the running total
// rather than throwing.
function toMinorUnits(raw: string): number {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
}

export type BudgetAllocation = {
  allocatedAmount: number;
  remainingAmount: number;
  percentage: number;
  isOverBudget: boolean;
};

// Real-time "how much of the expected income is already claimed by
// category limits" summary shown in BudgetForm as the user types. Sums
// and subtracts through dinero.js rather than plain `+`/`-` on raw
// numbers (AGENTS.md's "Money values" convention) — converts back to a
// plain number only at the end, for the caller's own
// useFormatter().number() to format.
export function computeBudgetAllocation(
  expectedIncome: string,
  limits: string[],
): BudgetAllocation {
  const income = dinero({ amount: toMinorUnits(expectedIncome), currency: BRL });
  const allocated = limits.reduce(
    (total, limit) => add(total, dinero({ amount: toMinorUnits(limit), currency: BRL })),
    dinero({ amount: 0, currency: BRL }),
  );
  const remaining = subtract(income, allocated);

  const incomeAmount = Number(toDecimal(income));
  const allocatedAmount = Number(toDecimal(allocated));
  const remainingAmount = Number(toDecimal(remaining));

  return {
    allocatedAmount,
    remainingAmount,
    percentage:
      incomeAmount > 0 ? Math.round((allocatedAmount / incomeAmount) * 100) : 0,
    isOverBudget: isNegative(remaining),
  };
}
