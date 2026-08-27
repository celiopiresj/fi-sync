import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "./_components/reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const t = await getTranslations("scrn-reset-password");
  const { token } = await searchParams;

  return (
    <AuthShell
      title={t("title")}
      description={t("description")}
      footer={
        <>
          {t("footer.remembered")}{" "}
          <Link href="/auth/sign-in" className="font-medium text-primary">
            {t("footer.signIn")}
          </Link>
        </>
      }
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-center text-sm text-destructive">
          {t("errors.invalidToken")}
        </p>
      )}
    </AuthShell>
  );
}
