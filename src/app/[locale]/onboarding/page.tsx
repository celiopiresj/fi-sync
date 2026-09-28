import { getLocale } from "next-intl/server";
import { listCategories } from "@/app/[locale]/(app)/categories/actions";
import {
  currentPeriod,
  periodRange,
} from "@/app/[locale]/(app)/transactions/_lib/period";
import { auth } from "@/lib/auth/server";
import { ensureUserSynced } from "@/lib/auth/sync-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import { OnboardingWizard } from "./_components/onboarding-wizard";

export default async function OnboardingPage() {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  const locale = await getLocale();

  // Every screen requires a logged-in user — proxy.ts already redirects
  // unauthenticated requests, this is the page-level guard for the same rule.
  if (!userId) {
    redirect({ href: "/auth/sign-in", locale });
  } else {
    // Onboarding is only for users with no Account yet — the mirror of the
    // (app) layout's check, which sends account-less users here. Anyone who
    // already has one goes back home instead of re-running the wizard. The
    // wizard only creates Accounts on its final submit (see
    // onboarding-wizard.tsx), so this never interrupts an onboarding in
    // progress.
    const hasAccount = await prisma.account.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (hasAccount) {
      redirect({ href: "/", locale });
    }

    // Every user without an Account lands here, so this is the one place
    // guaranteed to run before the first `account.create`. Sign-in/sign-up/
    // callback already sync the user, but a session can outlive its
    // `public.User` row (e.g. a still-valid cookie after the public schema
    // was reset), which made account creation fail with
    // `Account_userId_fkey`. The sync is idempotent, so re-running it here
    // is safe.
    await ensureUserSynced(userId);
  }

  const categories = await listCategories();
  const seededCategories = categories.filter((category) => category.userId === null);
  const monthKey = periodRange(currentPeriod()).from.slice(0, 7);

  return <OnboardingWizard seededCategories={seededCategories} monthKey={monthKey} />;
}
