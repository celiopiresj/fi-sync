"use server";

import { auth } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { makeErrorMap } from "@/lib/zod/zod-error-map";
import { forgotPasswordSchema, type ForgotPasswordValues } from "./schema";

type ActionResult = { error?: string };

export async function requestPasswordReset(
  data: ForgotPasswordValues,
): Promise<ActionResult> {
  const t = await getTranslations("common.validation");
  const result = forgotPasswordSchema.safeParse(data, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorMap: makeErrorMap(t) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  if (!result.success) {
    return { error: "Invalid data provided." };
  }

  // Better Auth resolves this successfully regardless of whether the
  // email is registered, so we never leak account existence here.
  const { error } = await auth.requestPasswordReset({
    email: result.data.email,
    redirectTo: "/auth/reset-password",
  });

  if (error) {
    return { error: String(error.message ?? "request_failed") };
  }

  return {};
}
