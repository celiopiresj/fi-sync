import type { listPeople, getPersonStatement } from "../actions";

export type PersonRow = Awaited<ReturnType<typeof listPeople>>[number];

// Which statement cycle the person detail page (people/[id]) is showing —
// lives here rather than under [id]/_types since actions.ts (this route's
// parent) needs it as a param type for getPersonStatement.
export type StatementPeriod = { year: number; month: number };

// Also lives at this parent level (re-exported by [id]/_types/types.ts)
// rather than only under [id]/_types, since _lib/statement-message.ts
// (used by both the person detail page and the people list's "Cobrar"
// shortcut) needs it too.
export type PersonStatement = Awaited<ReturnType<typeof getPersonStatement>>;

// Which way a person's all-time balance points (see balanceStatusOf in
// _lib/people-list.ts for the sign convention).
export type BalanceStatus = "toReceive" | "toPay" | "settled";

// The people list's status tabs: every person, or only one balance side.
export type BalanceStatusFilter = "all" | BalanceStatus;

// Header figures of the people list (the self person is left out).
export type PeopleSummary = {
  totalToReceive: number;
  totalToPay: number;
  pendingCount: number;
};
