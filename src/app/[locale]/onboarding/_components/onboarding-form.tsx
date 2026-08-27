"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form/form-error";
import { isNextRedirectError } from "@/lib/next/is-redirect-error";
import { useZodForm } from "@/lib/form/use-zod-form";
import { createAccount } from "@/app/[locale]/(app)/accounts/actions";
import {
  onboardingAccountSchema,
  emptyOnboardingAccountFormValues,
} from "../_schema/schema";

export function OnboardingForm() {
  const t = useTranslations("scrn-onboarding");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useZodForm(onboardingAccountSchema, {
    defaultValues: emptyOnboardingAccountFormValues,
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const result = await createAccount({
          name: value.name,
          type: "CHECKING",
        });
        if (result?.error) {
          setServerError(result.error);
          return;
        }
        router.push("/");
      } catch (err) {
        if (isNextRedirectError(err)) throw err;
        setServerError(t("errors.generic.description"));
      }
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
      <form.AppField name="name">
        {(field) => (
          <field.TextField
            label={t("fields.name.label")}
            placeholder={t("fields.name.placeholder")}
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
