"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form/form-error";
import { useZodForm } from "@/lib/form/use-zod-form";
import { resetPassword } from "../actions";
import { resetPasswordSchema } from "../schema";

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations("scrn-reset-password");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useZodForm(resetPasswordSchema, {
    defaultValues: { newPassword: "" },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const result = await resetPassword(token, value);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      toast.success(t("toast.success"));
      router.push("/auth/sign-in");
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex w-full flex-col gap-4"
    >
      <form.AppField name="newPassword">
        {(field) => (
          <field.TextField
            label={t("fields.newPassword.label")}
            type="password"
          />
        )}
      </form.AppField>

      <FormError title={t("errors.generic.title")} description={serverError} />

      <form.AppForm>
        <form.SubmitButton
          label={t("buttons.submit")}
          submittingLabel={t("buttons.submitting")}
          className="w-full"
          icon={<ArrowRightIcon className="size-4" />}
        />
      </form.AppForm>
    </form>
  );
}
