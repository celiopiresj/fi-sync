// Separates the +/− sign from the currency symbol with a space
// ("− R$ 50,00", not "-R$ 50,00") — Intl's own `signDisplay: "always"`
// glues the sign directly onto the currency symbol, which in pt-BR reads
// as one dense token instead of a legible amount. Duplicated from
// transactions/_lib/format-signed-amount.ts rather than imported — _lib
// is a private, per-route folder (AGENTS.md), so each route keeps its
// own copy of small generic helpers like this one instead of reaching
// into another feature's private folder. Takes a plain "format this
// non-negative number as currency" callback rather than a next-intl
// formatter directly, so this stays decoupled from next-intl — callers
// pass `(value) => format.number(value, { style: "currency", currency:
// "BRL" })`. Zero renders with "+" (amount >= 0), matching the
// text-positive/text-negative color split used throughout both tables.
export function formatSignedAmount(
  amount: number,
  formatCurrency: (value: number) => string,
): string {
  const sign = amount < 0 ? "−" : "+";
  return `${sign} ${formatCurrency(Math.abs(amount))}`;
}
