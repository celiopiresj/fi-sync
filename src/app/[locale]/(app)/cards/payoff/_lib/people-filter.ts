// Adds `personId` to the selection, or takes it out if it's already in.
export function togglePersonId(personIds: string[], personId: string): string[] {
  return personIds.includes(personId)
    ? personIds.filter((id) => id !== personId)
    : [...personIds, personId];
}

// Case- and accent-insensitive "contains", so "mae" finds "Mãe".
export function matchesPersonQuery(name: string, query: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR");
  return normalize(name).includes(normalize(query.trim()));
}
