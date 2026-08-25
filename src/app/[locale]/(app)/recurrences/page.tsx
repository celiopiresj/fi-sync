import { getRecurrenceFormOptions, listRecurrences } from "./actions";
import { RecurrencesView } from "./_components/recurrences-view";

export default async function RecurrencesPage() {
  const [options, recurrences] = await Promise.all([
    getRecurrenceFormOptions(),
    listRecurrences(),
  ]);

  return (
    <RecurrencesView
      initialRecurrences={recurrences}
      accounts={options.accounts}
      categories={options.categories}
      initialPeople={options.people}
      initialDefaultPersonId={options.defaultPersonId}
    />
  );
}
