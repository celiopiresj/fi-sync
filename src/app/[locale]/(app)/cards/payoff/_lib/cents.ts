import { allocate, BRL, dinero, toDecimal, toSnapshot } from "dinero.js";

// The payoff calculation runs entirely on integer cents — exact, unlike a
// float sum — converted only at the edges: in from Prisma's Decimal
// (actions.ts) and back out to reais for the client. Same approach as
// invoices/actions.ts's payInvoice (owed/paid maps in cents, dinero.js
// for the proportional split and the conversion).
export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return Number(toDecimal(dinero({ amount: cents, currency: BRL })));
}

// Splits `totalCents` across `weights` without losing the remainder —
// dinero.js's `allocate`, so the shares always add back up exactly.
export function allocateCents(totalCents: number, weights: number[]): number[] {
  return allocate(dinero({ amount: totalCents, currency: BRL }), weights).map(
    (share) => toSnapshot(share).amount,
  );
}
