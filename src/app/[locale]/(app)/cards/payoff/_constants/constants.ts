import type { PayoffScope } from "../_schema/schema";

// The "Todos os cartões"/"Todas as pessoas" option of the filter
// Selects — a Select item can't carry an `undefined` value, so this
// stands in for "no filter" and is mapped back to `undefined` on change.
export const ALL_VALUE = "__all__";

// What the screen opens on — "quitar o cartão" means everything owed,
// not just the installments. page.tsx's initial fetch relies on the
// server applying this same default when no scope is passed.
export const DEFAULT_SCOPE: PayoffScope = "all";
