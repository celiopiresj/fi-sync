import {
  evaluateExpression,
  isCompoundExpression,
} from "@/lib/math/safe-expression";

// Amount helpers shared by every batch row editor (the desktop table's
// draft card and the mobile full-screen batch screen). Pulled out of
// batch-transaction-table.tsx when the mobile screen needed the same
// math: split arithmetic is delicate enough that a second hand-written
// copy is how the two drift apart on a rounding edge.

// Resolves a typed amount (comma/period decimals, or an expression like
// "120+35" — same convention as the single-transaction form's amount
// field) to a plain positive number, or null if it isn't one yet. Queued
// rows store the *resolved* value, not the raw typed string — a queued
// row is a fixed snapshot, not something that re-evaluates later.
export function resolveAmount(raw: string): number | null {
  const evaluated = isCompoundExpression(raw) ? evaluateExpression(raw) : null;
  const parsed = evaluated ?? (raw ? Number(raw.replace(",", ".")) : NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Split amounts are tracked in integer cents — same reasoning as
// debit-transaction-form.tsx's own "Dividir com outras pessoas" math.
export function toCents(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function parseAmountLoose(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function centsToAmountString(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
