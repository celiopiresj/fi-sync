import { todayCalendarDate } from "@/lib/date";
import { connectionSchema, mappingSchema, processSchema, reviewEditsSchema, calendarDateSchema } from "@/lib/open-finance/schema";
import { NO_CATEGORY } from "@/lib/open-finance/review";
import { isNegativeAmount } from "@/lib/open-finance/normalize";
import { z } from "zod";
import type { MappingFormProps, ReviewFormProps } from "../_types/types";

export { connectionSchema, mappingSchema, processSchema };
export const connectionDefaults = { label: "", itemId: "" };
export const reviewFormSchema = reviewEditsSchema.extend({
  existingTransactionId: z.string().max(200),
  closingDate: z.union([calendarDateSchema, z.literal("")]),
  dueDate: z.union([calendarDateSchema, z.literal("")]),
});
export function mappingDefaults(source: MappingFormProps["source"]) {
  return { sourceId: source.id, accountId: source.accountId ?? "", cardId: source.cardId ?? "", fromDate: source.fromDate ?? `${todayCalendarDate().slice(0, 7)}-01` };
}
export function reviewDefaults({ source, row, review }: ReviewFormProps) {
  return { sourceId: source.id, transactionId: row.id, mode: "create" as "create" | "match" | "ignore", existingTransactionId: "", closingDate: review.closingDate, dueDate: review.dueDate, expectedAmount: review.amount, expectedDate: review.date, expectedDescription: review.description };
}
export function reviewEditDefaults({ review }: ReviewFormProps) {
  return {
    description: review.description, date: review.date,
    amount: review.amount.replace(/^-/, "").replace(".", ","),
    type: isNegativeAmount(review.amount) ? "expense" as const : "income" as const,
    categoryId: NO_CATEGORY, closingDate: review.closingDate, dueDate: review.dueDate, existingTransactionId: "",
  };
}
