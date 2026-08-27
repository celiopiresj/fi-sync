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
import { signUpWithEmail } from "./actions";
import { signUpSchema, type SignUpValues } from "./schema";

export default function SignUpPage() {
  const t = useTranslations("scrn-sign-up");
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useZodForm(signUpSchema, {
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },

    onSubmit: async ({ value }: { value: SignUpValues }) => {
      setServerError(null);
      try {
        const result = await signUpWithEmail(value);
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
          {t("footer.hasAccount")}{" "}
          <Link href="/auth/sign-in" className="font-medium text-primary">
            {t("footer.signIn")}
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
        <form.AppField name="name">
          {(field) => (
            <field.TextField
              label={t("fields.name.label")}
              placeholder={t("fields.name.placeholder")}
              autoComplete="name"
            />
          )}
        </form.AppField>

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

        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label={t("fields.password.label")}
              type="password"
              autoComplete="new-password"
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
    </AuthShell>
  );
}
