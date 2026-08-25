import type {
  listRecurrences,
  getRecurrenceFormOptions,
  RecurrenceFilters,
} from "../actions";

export type { RecurrenceFilters };

export type RecurrenceRow = Awaited<ReturnType<typeof listRecurrences>>[number];
export type RecurrenceFormOptions = Awaited<
  ReturnType<typeof getRecurrenceFormOptions>
>;
export type AccountOption = RecurrenceFormOptions["accounts"][number];
export type CategoryOption = RecurrenceFormOptions["categories"][number];
export type PersonOption = RecurrenceFormOptions["people"][number];
// Nested off AccountOption (accounts are fetched with `include: { cards:
// true }`, same as transactions' own getTransactionFormOptions) rather
// than a separate top-level list — the form reads
// `selectedAccount.cards`, mirroring transaction-form.tsx exactly.
export type CardOption = AccountOption["cards"][number];
