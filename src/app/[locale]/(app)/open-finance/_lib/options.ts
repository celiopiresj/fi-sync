import { matchesSearch } from "@/lib/normalize-search";
import type { MappingFormProps, Overview, Review, Source, SourceOption } from "../_types/types";
import { NO_CATEGORY } from "@/lib/open-finance/review";

export function mappingAccountOptions(source: Source, accounts: MappingFormProps["accounts"]) {
  return accounts.filter((account) => account.currency === source.currency &&
    (source.type === "CREDIT" ? account.type === "CREDIT_CARD" : account.type !== "CREDIT_CARD"))
    .map((account) => ({ value: account.id, label: account.name }));
}
export function mappingCardOptions(accountId: string, accounts: MappingFormProps["accounts"]) {
  return (accounts.find((account) => account.id === accountId)?.cards ?? []).map((card) => ({ value: card.id, label: card.name }));
}
export function mappedSources(overview: Overview) {
  return overview.connections.filter((connection) => connection.active).flatMap((connection) => connection.sources.map((source) => ({ ...source, bankLabel: connection.label, connectionId: connection.id })));
}
export function groupSources<T extends Pick<Source, "type">>(sources: T[]) {
  return [
    { type: "BANK", title: "accounts" as const, empty: "emptyAccounts" as const, sources: sources.filter((source) => source.type === "BANK") },
    { type: "CREDIT", title: "cards" as const, empty: "emptyCards" as const, sources: sources.filter((source) => source.type === "CREDIT") },
  ];
}
export function sourceDestination(source: Source, accounts: Overview["accounts"]) {
  const account = accounts.find((account) => account.id === source.accountId);
  return { account, card: account?.cards.find((card) => card.id === source.cardId) };
}
export function sourceReady(source: Source, accounts: Overview["accounts"]) {
  const { account, card } = sourceDestination(source, accounts);
  return Boolean(account && source.fromDate && account.currency === source.currency &&
    (source.type === "CREDIT" ? account.type === "CREDIT_CARD" && card : ["CHECKING", "SAVINGS"].includes(account.type)));
}
export function reviewCategoryOptions(categories: Review["categories"], type: string, none?: string) {
  const filtered = categories.filter((category) => category.type === (type === "expense" ? "EXPENSE" : "INCOME"))
    .map((category) => ({ value: category.id, label: category.name }));
  return none ? [{ value: NO_CATEGORY, label: none }, ...filtered] : filtered;
}
// Opens on the last source the owner used when it still exists, otherwise
// on the first one ready to review, so the screen rarely starts empty.
export function defaultSourceId(sources: SourceOption[], accounts: Overview["accounts"], storedId: string | null) {
  if (storedId && sources.some((source) => source.id === storedId)) return storedId;
  return (sources.find((source) => sourceReady(source, accounts)) ?? sources[0])?.id ?? "";
}
export function filterSources(sources: SourceOption[], accounts: Overview["accounts"], query: string) {
  if (!query.trim()) return sources;
  return sources.filter((source) => matchesSearch(`${source.name} ${source.bankLabel} ${sourceDestination(source, accounts).account?.name ?? ""}`, query));
}
