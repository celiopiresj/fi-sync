import type { getMoreOverview } from "../actions";

export type MoreOverview = Awaited<ReturnType<typeof getMoreOverview>>;
