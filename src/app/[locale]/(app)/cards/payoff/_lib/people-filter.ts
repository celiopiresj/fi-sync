import { matchesSearch } from "@/lib/normalize-search";

// Adds `personId` to the selection, or takes it out if it's already in.
export function togglePersonId(personIds: string[], personId: string): string[] {
  return personIds.includes(personId)
    ? personIds.filter((id) => id !== personId)
    : [...personIds, personId];
}

// Case- and accent-insensitive "contains", so "mae" finds "Mãe".
export function matchesPersonQuery(name: string, query: string): boolean {
  return matchesSearch(name, query);
}
