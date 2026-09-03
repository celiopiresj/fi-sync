import type { getWalletOverview } from "../actions";

export type WalletOverview = Awaited<ReturnType<typeof getWalletOverview>>;
