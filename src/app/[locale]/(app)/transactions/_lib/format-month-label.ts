// Fixed pt-BR abbreviated month labels for the "Saldo mensal" chart's
// X axis (transactions screen summary card). Deliberately NOT routed
// through next-intl/useTranslations — the chart always shows month
// abbreviations in pt-BR regardless of the active UI locale, precisely
// so the client chart component doesn't need locale context at all (see
// getMonthlyBalances in actions.ts, which formats this server-side for
// exactly that reason). This is an intentional, narrow exception to the
// "no hardcoded UI text" rule in AGENTS.md, not an oversight — it's not
// user-facing copy so much as a chart-axis convention.
const MONTH_ABBREVIATIONS_PT_BR = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

// `monthIndex` is 0-indexed, same convention as `Period.month` in
// _lib/period.ts and `Date#getMonth`.
export function formatMonthAbbreviationPtBr(monthIndex: number): string {
  return MONTH_ABBREVIATIONS_PT_BR[monthIndex];
}
