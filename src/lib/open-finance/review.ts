import { BRL, dinero, multiply, toDecimal } from "dinero.js";
import { parseCalendarDate } from "@/lib/date";
import type { ReviewEdits } from "@/lib/open-finance/schema";

export const NO_CATEGORY = "__none__";

export function reviewedTransaction(edits: ReviewEdits) {
  const [whole, fraction = ""] = edits.amount.replace(",", ".").split(".");
  const magnitude = dinero({ amount: Number(`${whole}${fraction.padEnd(2, "0")}`), currency: BRL });
  return {
    description: edits.description.trim(),
    date: parseCalendarDate(edits.date),
    amount: toDecimal(edits.type === "expense" ? multiply(magnitude, -1) : magnitude),
    categoryId: edits.categoryId && edits.categoryId !== NO_CATEGORY ? edits.categoryId : null,
  };
}
