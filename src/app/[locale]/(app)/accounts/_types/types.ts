import type { listAccounts } from "../actions";
import type { AccountTypeOption } from "../_schema/schema";

export type AccountRow = Awaited<ReturnType<typeof listAccounts>>[number];

// One section of the accounts screen: every account of one type, already
// sorted (see groupAccountsByType in _lib/account-groups.ts).
export type AccountGroup = {
  type: AccountTypeOption;
  accounts: AccountRow[];
  balance: number;
};

export type AccountsSummary = {
  totalBalance: number;
  accountsCount: number;
};
