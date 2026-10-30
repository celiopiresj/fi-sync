import { dinero, toDecimal, BRL } from "dinero.js";

// Turns a stored amount (a plain number read back from a Prisma Decimal)
// into the "1234,50" string AmountInput shows after its own blur mask —
// the same comma-decimal, always-two-cents shape. Edit forms used to seed
// the field with `Math.abs(amount).toString()`, which opened as "12.34" /
// "12.3" (period, cents dropped) until the user touched the field. Sign
// is dropped on purpose: forms carry the direction in a separate
// income/expense field.
export function formatAmountInput(amount: number): string {
  const cents = Math.round(Math.abs(amount) * 100);
  return toDecimal(dinero({ amount: cents, currency: BRL }), ({ value }) =>
    value.replace(".", ","),
  );
}
