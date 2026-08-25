import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, { message: "validation.required" }),
  type: z.enum(["EXPENSE", "INCOME", "INVESTMENT"]),
  colorStyle: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

export const emptyCategoryFormValues: CategoryFormValues = {
  name: "",
  type: "EXPENSE",
  colorStyle: null,
  icon: null,
};

