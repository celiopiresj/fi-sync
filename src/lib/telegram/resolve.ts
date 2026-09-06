// Name -> row resolution for the bot's tools.
//
// The tools used to take ids, which meant every write was preceded by a
// listAccounts + listCategories (+ listPeople) round-trip whose only
// purpose was to put 25-character cuids into the model's context — and
// those ids never survived into the next turn, since the chat history
// stores plain text (src/lib/telegram/history.ts), so the confirmation
// turn paid for all of it a second time. Taking the NAME the user already
// typed and matching it here removes both the listing steps and the ids
// themselves from the prompt.
//
// Matching is deliberately forgiving in one direction only: it never
// guesses between two plausible rows. Anything ambiguous comes back as a
// question with the candidates in it, so the bot asks instead of writing
// to the wrong account — but that question has to be ANSWERABLE, which is
// what `disambiguate` below is for: a user with a "Nubank" checking
// account and a "Nubank" credit card was being asked whether they meant
// "Nubank or Nubank", and every answer looped straight back into the same
// question.

export type Named = { name: string };

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    // Punctuation becomes a word break rather than part of a word, so
    // "Nubank (conta corrente)" and "Itaú - Corrente" split into the same
    // words the user would type back at us.
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Candidate<T> = { row: T; name: string };

// Wraps rows for matching, appending a distinguishing label to the ones
// whose name is shared with another row ("Nubank" -> "Nubank (conta
// corrente)" / "Nubank (cartão de crédito)"). Only the duplicates get it:
// a unique name stays exactly as the user knows it. The label is part of
// the matched name too, not just of the question, so the answer to "qual
// delas?" resolves on the next message.
export function disambiguate<T extends Named>(
  rows: T[],
  describe: (row: T) => string,
): Candidate<T>[] {
  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeName(row.name);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  return rows.map((row) => ({
    row,
    name:
      (seen.get(normalizeName(row.name)) ?? 0) > 1
        ? `${row.name} (${describe(row)})`
        : row.name,
  }));
}

// Exact match wins outright; only if there is none does it fall back to
// prefix, then to substring in either direction ("nubank" finds "Nubank
// Cartão", "cartão nubank" finds "Nubank"). Each tier is considered on
// its own, so an exact "Casa" is never beaten by "Casa da Praia" also
// containing it.
export function matchByName<T extends Named>(
  rows: T[],
  query: string,
): { match: T } | { candidates: T[] } {
  const target = normalizeName(query);
  if (!target) return { candidates: rows };

  const tiers = [
    rows.filter((row) => normalizeName(row.name) === target),
    rows.filter((row) => normalizeName(row.name).startsWith(target)),
    // Word overlap, before plain substring, so word ORDER doesn't decide
    // the answer: "cartão nubank" has to reach "Nubank Cartão" and not
    // stop at "Nubank", which the substring tier alone would pick (the
    // query contains it, and the two-word name doesn't contain the query).
    bestWordOverlap(rows, target),
    rows.filter((row) => {
      const name = normalizeName(row.name);
      return name.includes(target) || target.includes(name);
    }),
  ];

  for (const tier of tiers) {
    if (tier.length === 1) return { match: tier[0] };
    if (tier.length > 1) return { candidates: tier };
  }

  return { candidates: [] };
}

// The rows sharing the most words with the query — "Nubank Cartão"
// scores 2 against "cartão nubank", "Nubank" scores 1. A tie is left for
// the caller to turn into a question; no overlap at all falls through to
// the next tier.
function bestWordOverlap<T extends Named>(rows: T[], target: string): T[] {
  const queryWords = new Set(target.split(" "));
  const scored = rows.map((row) => ({
    row,
    score: normalizeName(row.name)
      .split(" ")
      .filter((word) => queryWords.has(word)).length,
  }));
  const best = Math.max(0, ...scored.map((entry) => entry.score));
  return best === 0 ? [] : scored.filter((entry) => entry.score === best).map((entry) => entry.row);
}

// pt-BR because every one of these strings can end up in front of the
// user: a create tool ends the model's turn (see agent.ts), so a failed
// match is often sent to Telegram exactly as written here.
export function resolveNamed<T extends Named>(
  rows: T[],
  query: string,
  kind: { article: string; plural: string },
): { match: T } | { error: string } {
  const result = matchByName(rows, query);
  if ("match" in result) return result;

  if (rows.length === 0) {
    return { error: `Você ainda não cadastrou ${kind.plural} no Fi-Sync.` };
  }

  const names = (result.candidates.length > 0 ? result.candidates : rows).map(
    (row) => row.name,
  );

  return {
    error:
      result.candidates.length > 1
        ? `"${query}" pode ser ${joinOr(names)}. Qual delas?`
        : `Não achei ${kind.article} "${query}". Tenho: ${names.join(", ")}.`,
  };
}

function joinOr(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ou ${names[names.length - 1]}`;
}

export const ACCOUNT_KIND = { article: "a conta", plural: "contas" };
export const CATEGORY_KIND = { article: "a categoria", plural: "categorias" };
export const PERSON_KIND = { article: "a pessoa", plural: "pessoas" };
export const CARD_KIND = { article: "o cartão", plural: "cartões" };
