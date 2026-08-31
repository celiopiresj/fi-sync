import { listLoans, getLoanFormOptions } from "./actions";
import { LoansView } from "./_components/loans-view";

export default async function LoansPage() {
  const [loans, options] = await Promise.all([
    listLoans(),
    getLoanFormOptions(),
  ]);

  return (
    <LoansView
      initialLoans={loans}
      people={options.people}
      accounts={options.accounts}
    />
  );
}
