import { getTransactionFormOptions, listTransactions } from "./actions";
import { TransactionsView } from "./_components/transactions-view";
import { currentPeriod, periodRange } from "./_lib/period";

export default async function TransactionsPage() {
  // The screen's header now always shows one month at a time (period
  // stepper, defaulting to the current month) instead of an all-time
  // list — this initial fetch has to match that default exactly, or
  // TransactionsView's query would treat this all-time result as valid
  // cached data for its month-scoped query key and never refetch,
  // showing every transaction ever made mislabeled as "this month" until
  // something else happened to trigger a refetch.
  const { from, to } = periodRange(currentPeriod());

  const [options, transactions] = await Promise.all([
    getTransactionFormOptions(),
    listTransactions({ from, to }),
  ]);

  return (
    <TransactionsView
      initialTransactions={transactions}
      accounts={options.accounts}
      categories={options.categories}
      initialPeople={options.people}
      initialDefaultPersonId={options.defaultPersonId}
    />
  );
}
