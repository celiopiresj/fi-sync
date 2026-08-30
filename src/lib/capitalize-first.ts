// Capitalizes only the string's first character, leaving the rest as
// typed — unlike Tailwind's `capitalize` class (per-WORD text-transform,
// applied via CSS), which wrongly uppercases every word including a
// pt-BR preposition in a label like "setembro de 2026" ("Setembro De
// 2026"). Done in JS rather than CSS's `first-letter:uppercase` so it
// also works for a chart axis tick rendered as SVG `<text>`, where
// `::first-letter` support is inconsistent.
export function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}
