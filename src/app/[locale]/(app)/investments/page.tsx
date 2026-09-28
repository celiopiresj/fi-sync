import {
  listInvestmentAccounts,
  listMovementPeople,
  listTransferAccounts,
} from "./actions";
import { InvestmentsView } from "./_components/investments-view";

export default async function InvestmentsPage() {
  const [accounts, transferAccounts, people] = await Promise.all([
    listInvestmentAccounts(),
    listTransferAccounts(),
    listMovementPeople(),
  ]);

  return (
    <InvestmentsView
      initialAccounts={accounts}
      transferAccounts={transferAccounts}
      people={people}
    />
  );
}
