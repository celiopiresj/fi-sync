import { add, BRL, dinero, equal, multiply, toDecimal } from "dinero.js";
import { parseCalendarDate } from "@/lib/date";
import { OpenFinanceError, type ReviewEdits } from "@/lib/open-finance/schema";

export const NO_CATEGORY = "__none__";

function parseMagnitude(value: string) {
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  return dinero({ amount: Number(`${whole}${fraction.padEnd(2, "0")}`), currency: BRL });
}

export function reviewedTransaction(edits: ReviewEdits) {
  const magnitude = parseMagnitude(edits.amount);
  const signedAmount = edits.type === "expense" ? multiply(magnitude, -1) : magnitude;
  const amount = toDecimal(signedAmount);
  const splits = edits.splits ?? [];
  const personId = edits.personId ?? "";
  let resolvedSplits: { personId: string; amount: string }[] = [];
  if (splits.length > 0) {
    const parsedSplits = splits.map((split) => ({
      personId: split.personId,
      magnitude: parseMagnitude(split.amount),
    }));
    const splitSum = parsedSplits.reduce(
      (total, split) => add(total, split.magnitude),
      dinero({ amount: 0, currency: BRL }),
    );
    if (!equal(splitSum, magnitude)) {
      throw new OpenFinanceError("invalid");
    }
    resolvedSplits = parsedSplits.map((split) => ({
      personId: split.personId,
      amount: toDecimal(edits.type === "expense" ? multiply(split.magnitude, -1) : split.magnitude),
    }));
  } else if (personId) {
    resolvedSplits = [{ personId, amount }];
  }
  return {
    description: edits.description.trim(),
    date: parseCalendarDate(edits.date),
    amount,
    categoryId: edits.categoryId && edits.categoryId !== NO_CATEGORY ? edits.categoryId : null,
    paymentMethod: edits.paymentMethod || null,
    splits: resolvedSplits,
  };
}
