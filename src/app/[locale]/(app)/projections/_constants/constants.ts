// Default horizon for getProjections (tasks/016-projections.md's "User
// Review Required" answer #3) — kept out of actions.ts since a
// "use server" file can only export async functions, not plain
// constants.
export const DEFAULT_MONTHS_AHEAD = 6;

// The period selector's own choices (redesign spec section 4.1) — the
// underlying month-by-month trajectory (actions.ts's computeMonthSeries)
// is always computed out to the largest of these, then sliced, so
// switching between them never changes the math, only how much of it is
// shown.
export const MONTHS_AHEAD_OPTIONS = [3, 6, 12] as const;
export type MonthsAheadOption = (typeof MONTHS_AHEAD_OPTIONS)[number];
export const MAX_MONTHS_AHEAD = 12;
