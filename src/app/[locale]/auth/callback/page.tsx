import { auth } from "@/lib/auth/server";
import { ensureUserSynced } from "@/lib/auth/sync-user";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

// OAuth (Google) lands here after auth.signIn.social() completes. Email/
// password sign-up syncs the user directly in its own action instead (see
// auth/sign-up/actions.ts) — this route only exists to catch the OAuth
// case, which has no other hook we control.
export const dynamic = "force-dynamic";

export default async function AuthCallbackPage() {
  const locale = await getLocale();
  const { data: session } = await auth.getSession();

  let isNewUser = false;
  if (session?.user?.id) {
    ({ isNewUser } = await ensureUserSynced(session.user.id));
  }

  redirect({ href: isNewUser ? "/onboarding" : "/", locale });
}
