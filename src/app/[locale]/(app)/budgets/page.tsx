import {
  currentPeriod,
  periodRange,
} from "@/app/[locale]/(app)/transactions/_lib/period";
import { getBudgetFormOptions, getBudgetWithSpending } from "./actions";
import { BudgetsView } from "./_components/budgets-view";

export default async function BudgetsPage() {
  const { from } = periodRange(currentPeriod());
  const monthKey = from.slice(0, 7); // "yyyy-MM"

  const [options, budget] = await Promise.all([
    getBudgetFormOptions(),
    getBudgetWithSpending(monthKey),
  ]);

  return (
    <BudgetsView
      initialBudget={budget}
      categories={options.categories}
      initialGroups={options.groups}
    />
  );
}
