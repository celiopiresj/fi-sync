"use client";

import { useTranslations } from "next-intl";

type FieldErrorsProps = {
  errors: Array<string | undefined | null>;
};

export function FieldErrors({ errors }: FieldErrorsProps) {
  const tCommon = useTranslations("common");

  if (!errors || errors.length === 0) return null;

  return (
    <p className="text-xs text-red-600 dark:text-red-400">
      {errors
        .filter(Boolean)
        .map((err) =>
          typeof err === "string" && err.startsWith("validation.")
            ? tCommon(err as any)
            : err
        )
        .join(", ")}
    </p>
  );
}
