import { getCategoryExpenseBreakdown, getTransactionFormOptions } from "../transactions/actions";
import { currentPeriod, periodRange } from "../transactions/_lib/period";
import { ALL_NON_CARD_ACCOUNTS_FILTER } from "../transactions/_constants/constants";
import { SpendingView } from "./_components/spending-view";

export default async function SpendingPage() {
  const { from, to } = periodRange(currentPeriod());

  // Débito is this screen's default lens too (same reasoning as
  // transactions/page.tsx's own initial fetch) — SpendingView's own
  // initial account-kind state has to match exactly, or this seed would
  // be cached under the wrong query key and get refetched immediately.
  // No person filter by default (matches SpendingView's own initial
  // state), same reasoning.
  const [breakdown, options] = await Promise.all([
    getCategoryExpenseBreakdown({
      from,
      to,
      accountId: ALL_NON_CARD_ACCOUNTS_FILTER,
    }),
    // Reuses the transaction form's own people list — same options this
    // screen's own "Ver transações" link scopes to, and the same list
    // people/[id] and transactions/page.tsx already fetch this way for
    // an equivalent person picker.
    getTransactionFormOptions(),
  ]);

  return <SpendingView initialBreakdown={breakdown} people={options.people} />;
}
