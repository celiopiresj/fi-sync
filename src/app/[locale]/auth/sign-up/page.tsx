"use client";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { FormError } from "@/components/form/form-error";
import { Link } from "@/i18n/navigation";
import { useZodForm } from "@/lib/form/use-zod-form";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";
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
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <Image
            src="/Fi-sync-logo.png"
            alt="fi-sync logo"
            width={120}
            height={40}
            className="object-contain"
            priority
          />
        </div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("description")}
        </p>
      </div>

      <GoogleSignInButton label={t("buttons.google")} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="flex w-full max-w-sm flex-col gap-4">
        <form.AppField name="name">
          {(field) => (
            <field.TextField
              label={t("fields.name.label")}
              placeholder={t("fields.name.placeholder")}
            />
          )}
        </form.AppField>

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
          />
        </form.AppForm>
      </form>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {t("footer.hasAccount")}{" "}
        <Link href="/auth/sign-in" className="font-medium underline">
          {t("footer.signIn")}
        </Link>
      </p>
    </div>
  );
}
