import { BRL, dinero, toDecimal } from "dinero.js";

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
  const amount = dinero({ amount: cents, currency: BRL });
  return toDecimal(amount, ({ value }) => value.replace(".", ","));
}

