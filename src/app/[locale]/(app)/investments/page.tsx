import { listInvestmentAccounts, listTransferAccounts } from "./actions";
import { InvestmentsView } from "./_components/investments-view";

export default async function InvestmentsPage() {
  const [accounts, transferAccounts] = await Promise.all([
    listInvestmentAccounts(),
    listTransferAccounts(),
  ]);

  return (
    <InvestmentsView initialAccounts={accounts} transferAccounts={transferAccounts} />
  );
}
