/**
 * Normalizes a string for search matching by stripping diacritics/accents
 * and converting to lower case, so e.g. "mãe" and "mae" match interchangeably.
 */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Checks if target string includes search query, ignoring case and accents.
 */
export function matchesSearch(target: string, query: string): boolean {
  const normalizedQuery = normalizeSearch(query.trim());
  if (!normalizedQuery) return true;
  return normalizeSearch(target).includes(normalizedQuery);
}

