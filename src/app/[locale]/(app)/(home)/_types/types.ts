import type { getHomeOverview } from "../actions";

export type HomeOverview = Awaited<ReturnType<typeof getHomeOverview>>;
