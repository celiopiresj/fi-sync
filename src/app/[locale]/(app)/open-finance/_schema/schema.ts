import { todayCalendarDate } from "@/lib/date";
import { connectionSchema, mappingSchema, processSchema } from "@/lib/open-finance/schema";
import type { MappingFormProps, ReviewFormProps } from "../_types/types";

export { connectionSchema, mappingSchema, processSchema };
export const connectionDefaults = { label: "", itemId: "" };
export function mappingDefaults(source: MappingFormProps["source"]) {
  return { sourceId: source.id, accountId: source.accountId ?? "", cardId: source.cardId ?? "", fromDate: source.fromDate ?? `${todayCalendarDate().slice(0, 7)}-01` };
}
export function reviewDefaults({ source, row, review }: ReviewFormProps) {
  return { sourceId: source.id, transactionId: row.id, mode: "create" as "create" | "match" | "ignore", existingTransactionId: "", closingDate: review.closingDate, dueDate: review.dueDate, expectedAmount: review.amount, expectedDate: review.date, expectedDescription: review.description };
}
