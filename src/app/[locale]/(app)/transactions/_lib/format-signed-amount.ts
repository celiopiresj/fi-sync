// Separates the +/− sign from the currency symbol with a space
// ("− R$ 50,00", not "-R$ 50,00") — Intl's own `signDisplay: "always"`
// glues the sign directly onto the currency symbol, which in pt-BR reads
// as one dense token instead of a legible amount (see the transactions
// table redesign spec, item 2). Takes a plain "format this non-negative
// number as currency" callback rather than a next-intl formatter
// directly, so this stays decoupled from next-intl — callers pass
// `(value) => format.number(value, { style: "currency", currency: "BRL" })`.
// Zero renders with "+" (amount >= 0), matching the existing
// text-positive/text-negative color split used throughout the table.
export function formatSignedAmount(
  amount: number,
  formatCurrency: (value: number) => string,
): string {
  const sign = amount < 0 ? "−" : "+";
  return `${sign} ${formatCurrency(Math.abs(amount))}`;
}
