"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthDivider } from "@/components/auth/auth-divider";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { FormError } from "@/components/form/form-error";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import { useZodForm } from "@/lib/form/use-zod-form";
import { signInWithEmail } from "./actions";
import { signInSchema } from "./schema";

export default function SignInPage() {
  const t = useTranslations("scrn-sign-in");
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useZodForm(signInSchema, {
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const result = await signInWithEmail(value);
        if (result?.error) {
          setServerError(result.error);
        }
      } catch (err) {
        if (isNextRedirectError(err)) {
          throw err;
        }
        setServerError(t("errors.generic.description"));
      }
    },
  });

  return (
    <AuthShell
      title={t("title")}
      description={t("description")}
      footer={
        <>
          {t("footer.noAccount")}{" "}
          <Link href="/auth/sign-up" className="font-medium text-primary">
            {t("footer.signUp")}
          </Link>
        </>
      }
    >
      <GoogleSignInButton label={t("buttons.google")} />

      <AuthDivider label={t("divider")} />

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
            />
          )}
        </form.AppField>

        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label={t("fields.password.label")}
              type="password"
              labelAction={
                <Link
                  href="/auth/forgot-password"
                  className="text-sm font-medium text-primary"
                >
                  {t("buttons.forgotPassword")}
                </Link>
              }
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
    </AuthShell>
  );
}
