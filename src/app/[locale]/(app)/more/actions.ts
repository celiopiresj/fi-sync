"use server";

import { todayCalendarDate } from "@/lib/date";
import { getBudgetWithSpending } from "../budgets/actions";
import { listRecurrences } from "../recurrences/actions";

// Cheap live counts for the "Mais" nav list's subtitles — deliberately
// narrow (just what these two already-existing queries hand back for
// free), not a new heavy aggregation. Projeções has no equivalent cheap
// counter today, so its row stays static (see MoreView) rather than
// inventing one.
export async function getMoreOverview() {
  const currentMonthKey = todayCalendarDate().slice(0, 7);

  const [budget, recurrences] = await Promise.all([
    getBudgetWithSpending(currentMonthKey),
    listRecurrences(),
  ]);

  const overBudgetCount = budget
    ? budget.items.filter((item) => item.spent > item.limit).length
    : 0;

  return {
    overBudgetCount,
    activeRecurrencesCount: recurrences.length,
    recurrencesNeedingExtensionCount: recurrences.filter((r) => r.needsExtension).length,
  };
}
