import type { MappingFormProps, Overview, Source } from "../_types/types";

export function mappingAccountOptions(source: Source, accounts: MappingFormProps["accounts"]) {
  return accounts.filter((account) => account.currency === source.currency &&
    (source.type === "CREDIT" ? account.type === "CREDIT_CARD" : account.type !== "CREDIT_CARD"))
    .map((account) => ({ value: account.id, label: account.name }));
}
export function mappingCardOptions(accountId: string, accounts: MappingFormProps["accounts"]) {
  return (accounts.find((account) => account.id === accountId)?.cards ?? []).map((card) => ({ value: card.id, label: card.name }));
}
export function mappedSources(overview: Overview) {
  return overview.connections.filter((connection) => connection.active).flatMap((connection) => connection.sources);
}
