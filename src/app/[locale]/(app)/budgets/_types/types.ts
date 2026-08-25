import type {
  getBudgetWithSpending,
  getBudgetFormOptions,
} from "../actions";

// The full budget payload returned by getBudgetWithSpending — includes
// the budget itself plus computed spending data per item.
export type BudgetWithSpending = NonNullable<
  Awaited<ReturnType<typeof getBudgetWithSpending>>
>;

export type BudgetItemWithSpending = BudgetWithSpending["items"][number];

// Options for the budget form — categories and groups available.
export type BudgetFormOptions = Awaited<
  ReturnType<typeof getBudgetFormOptions>
>;

export type CategoryOption = BudgetFormOptions["categories"][number];
export type GroupOption = BudgetFormOptions["groups"][number];
