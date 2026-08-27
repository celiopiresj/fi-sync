import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingForm } from "./_components/onboarding-form";

export default async function OnboardingPage() {
  const t = await getTranslations("scrn-onboarding");

  return (
    <AuthShell title={t("title")} description={t("description")}>
      <OnboardingForm />
    </AuthShell>
  );
}
