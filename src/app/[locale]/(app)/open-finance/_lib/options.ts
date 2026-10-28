import type { MappingFormProps, Overview, Review, Source } from "../_types/types";
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
  return overview.connections.filter((connection) => connection.active).flatMap((connection) => connection.sources.map((source) => ({ ...source, bankLabel: connection.label })));
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
export function reviewCategoryOptions(categories: Review["categories"], type: string, none: string) {
  return [{ value: NO_CATEGORY, label: none }, ...categories.filter((category) => category.type === (type === "expense" ? "EXPENSE" : "INCOME"))
    .map((category) => ({ value: category.id, label: category.name }))];
}
