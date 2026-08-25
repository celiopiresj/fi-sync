"use server";

import { auth } from "@/lib/auth/server";
import { ensureUserSynced } from "@/lib/auth/sync-user";
import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { makeErrorMap } from "@/lib/zod/zod-error-map";
import { signInSchema, type SignInValues } from "./schema";

export async function signInWithEmail(data: SignInValues) {
  const t = await getTranslations("common.validation");
  const result = signInSchema.safeParse(data, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorMap: makeErrorMap(t) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  if (!result.success) {
    return { error: "Invalid data provided." };
  }

  const { email, password } = result.data;

  const { data: authData, error } = await auth.signIn.email({
    email,
    password,
  });

  if (error) {
    return { error: String(error.message ?? "signin_failed") };
  }

  // Idempotent — mostly a safety net for accounts that predate the sync
  // logic, or any edge case where sign-up didn't sync correctly.
  if (authData?.user?.id) {
    await ensureUserSynced(authData.user.id);
  }

  const locale = await getLocale();
  redirect({ href: "/", locale });
}
