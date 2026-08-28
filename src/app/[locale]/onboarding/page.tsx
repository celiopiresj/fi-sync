import { listCategories } from "@/app/[locale]/(app)/categories/actions";
import {
  currentPeriod,
  periodRange,
} from "@/app/[locale]/(app)/transactions/_lib/period";
import { OnboardingWizard } from "./_components/onboarding-wizard";

export default async function OnboardingPage() {
  const categories = await listCategories();
  const seededCategories = categories.filter((category) => category.userId === null);
  const monthKey = periodRange(currentPeriod()).from.slice(0, 7);

  return <OnboardingWizard seededCategories={seededCategories} monthKey={monthKey} />;
}
