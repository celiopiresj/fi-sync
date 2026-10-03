import { getTranslations } from "next-intl/server";
import { AuthLoadingScreen } from "@/components/auth/auth-loading-screen";

export default async function AuthCallbackLoading() {
  const t = await getTranslations("common.auth");
  return <AuthLoadingScreen label={t("signingIn")} />;
}
