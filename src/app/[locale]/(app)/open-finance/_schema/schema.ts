import { add, BRL, dinero, equal } from "dinero.js";
import { todayCalendarDate } from "@/lib/date";
import { connectionSchema, mappingSchema, processSchema, reviewEditsSchema, calendarDateSchema, reviewDebitPaymentMethodValues } from "@/lib/open-finance/schema";
import { NO_CATEGORY } from "@/lib/open-finance/review";
import { isNegativeAmount } from "@/lib/open-finance/normalize";
import { z } from "zod";
import type { MappingFormProps, ReviewFormProps } from "../_types/types";

export { connectionSchema, mappingSchema, processSchema, reviewDebitPaymentMethodValues };
export const connectionDefaults = { label: "", itemId: "" };
export const reviewFormSchema = reviewEditsSchema.extend({
  existingTransactionId: z.string().max(200),
  closingDate: z.union([calendarDateSchema, z.literal("")]),
  dueDate: z.union([calendarDateSchema, z.literal("")]),
});
export type ReviewFormValues = z.infer<typeof reviewFormSchema>;

function parseLooseMoney(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^(?=.*[1-9])\d{1,10}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  return dinero({ amount: Number(`${whole}${fraction.padEnd(2, "0")}`), currency: BRL });
}

export function refineReviewForm(
  data: ReviewFormValues,
  ctx: z.RefinementCtx,
  options: {
    credit: boolean;
    hasPeople: boolean;
    messages: {
      required: string;
      splitsMismatch: string;
    };
  },
) {
  if (!data.categoryId || data.categoryId === NO_CATEGORY) {
    ctx.addIssue({
      code: "custom",
      path: ["categoryId"],
      message: options.messages.required,
    });
  }
  if (!options.credit && !data.paymentMethod) {
    ctx.addIssue({
      code: "custom",
      path: ["paymentMethod"],
      message: options.messages.required,
    });
  }
  if (options.hasPeople && !data.personId) {
    ctx.addIssue({
      code: "custom",
      path: ["personId"],
      message: options.messages.required,
    });
  }
  if (data.splits.length > 0) {
    const total = parseLooseMoney(data.amount);
    const splitMagnitudes = data.splits.map((split) => parseLooseMoney(split.amount));
    if (total && splitMagnitudes.every((item): item is NonNullable<typeof item> => item !== null)) {
      const splitSum = splitMagnitudes.reduce(
        (sum, item) => add(sum, item),
        dinero({ amount: 0, currency: BRL }),
      );
      if (!equal(splitSum, total)) {
        ctx.addIssue({
          code: "custom",
          path: ["splits"],
          message: options.messages.splitsMismatch,
        });
      }
    }
  }
}

export function mappingDefaults(source: MappingFormProps["source"]) {
  return { sourceId: source.id, accountId: source.accountId ?? "", cardId: source.cardId ?? "", fromDate: source.fromDate ?? `${todayCalendarDate().slice(0, 7)}-01` };
}
export function reviewDefaults({ source, row, review }: ReviewFormProps) {
  return { sourceId: source.id, transactionId: row.id, mode: "create" as "create" | "match" | "ignore", existingTransactionId: "", closingDate: review.closingDate, dueDate: review.dueDate, expectedAmount: review.amount, expectedDate: review.date, expectedDescription: review.description, expectedDestination: review.destinationSelection };
}
export function reviewEditDefaults({ review }: ReviewFormProps): ReviewFormValues {
  return {
    description: review.description, date: review.date,
    amount: review.amount.replace(/^-/, "").replace(".", ","),
    type: isNegativeAmount(review.amount) ? "expense" as const : "income" as const,
    categoryId: "",
    paymentMethod: review.credit ? "" : review.paymentMethod,
    personId: review.defaultPersonId,
    splits: [],
    closingDate: review.closingDate, dueDate: review.dueDate, existingTransactionId: "",
  };
}
