import { getRecurrenceFormOptions, listRecurrences } from "./actions";
import { RecurrencesView } from "./_components/recurrences-view";
import { ALL_NON_CARD_ACCOUNTS_FILTER } from "./_constants/constants";

export default async function RecurrencesPage() {
  const [options, recurrences] = await Promise.all([
    getRecurrenceFormOptions(),
    // Débito is the screen's default tab — must match recurrences-view.tsx's
    // own DEFAULT_SHEET_FILTERS so this seed stays valid for the cache.
    listRecurrences({ accountId: ALL_NON_CARD_ACCOUNTS_FILTER }),
  ]);

  return (
    <RecurrencesView
      initialRecurrences={recurrences}
      accounts={options.accounts}
      categories={options.categories}
      initialPeople={options.people}
      initialDefaultPersonId={options.defaultPersonId}
      defaultDebitAccountId={options.defaultDebitAccountId}
      defaultCreditAccountId={options.defaultCreditAccountId}
    />
  );
}
