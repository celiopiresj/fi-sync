import { listInvestmentAccounts } from "./actions";
import { InvestmentsView } from "./_components/investments-view";

export default async function InvestmentsPage() {
  const accounts = await listInvestmentAccounts();

  return <InvestmentsView initialAccounts={accounts} />;
}
