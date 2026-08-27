import { getTransactionFormOptions, listTransactions } from "./actions";
import { TransactionsView } from "./_components/transactions-view";
import { currentPeriod, parsePeriodKey, periodRange } from "./_lib/period";

type TransactionsPageProps = {
  // `?month=yyyy-MM`, `?person=`, `?category=`, `?type=income|expenses` —
  // set the same way (the projections screen's "Ver extrato" link,
  // tasks/016) so this page opens already scoped to them instead of
  // always the unfiltered current month.
  searchParams: Promise<{
    month?: string;
    person?: string;
    category?: string;
    type?: string;
  }>;
};

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  // The screen's header now always shows one month at a time (period
  // stepper, defaulting to the current month, or the `?month=` param
  // when set) instead of an all-time list — this initial fetch has to
  // match whichever period/sheet filters TransactionsView itself opens
  // with exactly, or its query would treat this result as valid cached
  // data for a different filter set's query key and never refetch,
  // showing the wrong data until something else triggered a refetch.
  const { month, person, category, type } = await searchParams;
  const { from, to } = periodRange(parsePeriodKey(month) ?? currentPeriod());
  const initialType = type === "income" || type === "expenses" ? type : undefined;

  const [options, transactions] = await Promise.all([
    getTransactionFormOptions(),
    listTransactions({
      from,
      to,
      personId: person,
      categoryId: category,
      type: initialType,
    }),
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
