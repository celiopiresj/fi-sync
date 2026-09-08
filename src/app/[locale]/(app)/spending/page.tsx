import { getCategoryExpenseBreakdown } from "../transactions/actions";
import { currentPeriod, periodRange } from "../transactions/_lib/period";
import { ALL_NON_CARD_ACCOUNTS_FILTER } from "../transactions/_constants/constants";
import { SpendingView } from "./_components/spending-view";

export default async function SpendingPage() {
  const { from, to } = periodRange(currentPeriod());

  // Débito is this screen's default lens too (same reasoning as
  // transactions/page.tsx's own initial fetch) — SpendingView's own
  // initial account-kind state has to match exactly, or this seed would
  // be cached under the wrong query key and get refetched immediately.
  const breakdown = await getCategoryExpenseBreakdown({
    from,
    to,
    accountId: ALL_NON_CARD_ACCOUNTS_FILTER,
  });

  return <SpendingView initialBreakdown={breakdown} />;
}
