"use server";

import { auth } from "@/lib/auth/server";
import { ensureUserSynced } from "@/lib/auth/sync-user";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { signUpSchema, type SignUpValues } from "./schema";
import { makeErrorMap } from "@/lib/zod/zod-error-map";

export async function signUpWithEmail(data: SignUpValues) {
  const t = await getTranslations("common.validation");
  const result = signUpSchema.safeParse(data, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorMap: makeErrorMap(t) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  if (!result.success) {
    return { error: "Invalid data provided." };
  }

  const { email, name, password } = result.data;

  const { data: authData, error } = await auth.signUp.email({
    email,
    name,
    password,
  });

  if (error) {
    return { error: error.message || "Failed to create account" };
  }

  if (authData?.user?.id) {
    await ensureUserSynced(authData.user.id);
  }

  const locale = await getLocale();
  redirect({ href: "/", locale });
}
