"use server";

import { auth } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { makeErrorMap } from "@/lib/zod/zod-error-map";
import { resetPasswordSchema, type ResetPasswordValues } from "./schema";

type ActionResult = { error?: string };

export async function resetPassword(
  token: string,
  data: ResetPasswordValues,
): Promise<ActionResult> {
  const t = await getTranslations("common.validation");
  const result = resetPasswordSchema.safeParse(data, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorMap: makeErrorMap(t) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  if (!result.success) {
    return { error: "Invalid data provided." };
  }

  const { error } = await auth.resetPassword({
    newPassword: result.data.newPassword,
    token,
  });

  if (error) {
    return { error: String(error.message ?? "reset_failed") };
  }

  return {};
}
