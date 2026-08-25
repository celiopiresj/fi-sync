import { listAccounts } from "./actions";
import { AccountsView } from "./_components/accounts-view";

export default async function AccountsPage() {
  const accounts = await listAccounts();

  return <AccountsView initialAccounts={accounts} />;
}
