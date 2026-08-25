import type { listAccounts } from "../actions";

export type AccountRow = Awaited<ReturnType<typeof listAccounts>>[number];
