import { z } from "zod";

// Budget form — expected income + array of category items with limits
// and optional group assignment.
const budgetItemSchema = z.object({
  categoryId: z.string().min(1),
  groupId: z.string().optional(),
  limit: z
    .string()
    .min(1)
    .transform((value) => Number(value.replace(",", ".")))
    .pipe(z.number().nonnegative()),
});

export const budgetSchema = z.object({
  expectedIncome: z
    .string()
    .min(1)
    .transform((value) => Number(value.replace(",", ".")))
    .pipe(z.number().nonnegative()),
  items: z.array(budgetItemSchema).min(1),
});

export type BudgetFormValues = z.input<typeof budgetSchema>;
export type BudgetValues = z.output<typeof budgetSchema>;

export type BudgetItemFormValues = z.input<typeof budgetItemSchema>;

// Empty form for creating a budget from scratch — items array starts
// empty, populated when the user picks categories to include.
export const emptyBudgetFormValues: BudgetFormValues = {
  expectedIncome: "",
  items: [],
};

// Budget group form — just a name.
export const budgetGroupSchema = z.object({
  name: z.string().min(1),
});

export type BudgetGroupFormValues = z.input<typeof budgetGroupSchema>;
export type BudgetGroupValues = z.output<typeof budgetGroupSchema>;
