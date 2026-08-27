"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormError } from "@/components/form/form-error";
import { useZodForm } from "@/lib/form/use-zod-form";
import { requestPasswordReset } from "./actions";
import { forgotPasswordSchema } from "./schema";

export default function ForgotPasswordPage() {
  const t = useTranslations("scrn-forgot-password");
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const form = useZodForm(forgotPasswordSchema, {
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const result = await requestPasswordReset(value);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      setSubmittedEmail(value.email);
    },
  });

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
      {submittedEmail ? (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <CheckCircleIcon className="size-8 text-primary" />
          <p className="text-sm text-muted-foreground">
            {t("success.description", { email: submittedEmail })}
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex w-full flex-col gap-4"
        >
          <form.AppField name="email">
            {(field) => (
              <field.TextField
                label={t("fields.email.label")}
                type="email"
                placeholder={t("fields.email.placeholder")}
                autoComplete="email"
              />
            )}
          </form.AppField>

          <FormError
            title={t("errors.generic.title")}
            description={serverError}
          />

          <form.AppForm>
            <form.SubmitButton
              label={t("buttons.submit")}
              submittingLabel={t("buttons.submitting")}
              className="w-full"
              icon={<ArrowRightIcon className="size-4" />}
            />
          </form.AppForm>
        </form>
      )}
    </AuthShell>
  );
}
