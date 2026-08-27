// Normalizes a Person's name to the correctly accented, capitalized form
// ("mae" -> "Mãe"). Used in two places: at write time (people/actions.ts —
// createPerson/updatePerson normalize before saving, so the stored name is
// already correct) and, for any row saved before that existed, at display
// time (transactions/_components/table/columns.tsx,
// transaction-mobile-list.tsx) as a defensive fallback. People are often
// added inline from a form's "cadastrar nova pessoa" field with quick,
// lazily-typed values instead of a proper name; this maps the common
// relation words to their correctly accented, capitalized form. Anything
// else just gets its first letter capitalized, per the same rule applied
// to a normal typed name.
const RELATION_WORDS: Record<string, string> = {
  mae: "Mãe",
  "mãe": "Mãe",
  pai: "Pai",
  irmao: "Irmão",
  "irmão": "Irmão",
  irma: "Irmã",
  "irmã": "Irmã",
  // Unaccented "avo" is genuinely ambiguous between avô/avó (grandfather/
  // grandmother) — default to the masculine form; the accented spellings
  // below still map correctly when the person typed the accent.
  avo: "Avô",
  "avô": "Avô",
  "avó": "Avó",
  tio: "Tio",
  tia: "Tia",
  filho: "Filho",
  filha: "Filha",
  sobrinho: "Sobrinho",
  sobrinha: "Sobrinha",
  primo: "Primo",
  prima: "Prima",
  marido: "Marido",
  esposa: "Esposa",
  namorado: "Namorado",
  namorada: "Namorada",
  sogro: "Sogro",
  sogra: "Sogra",
  cunhado: "Cunhado",
  cunhada: "Cunhada",
};

export function formatPersonName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const relation = RELATION_WORDS[trimmed.toLocaleLowerCase("pt-BR")];
  if (relation) return relation;

  return (
    trimmed.charAt(0).toLocaleUpperCase("pt-BR") + trimmed.slice(1)
  );
}
