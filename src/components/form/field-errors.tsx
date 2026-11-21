"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type FieldErrorsProps = {
  id?: string;
  className?: string;
  errors: Array<string | undefined | null>;
};

export function FieldErrors({ id, className, errors }: FieldErrorsProps) {
  const tCommon = useTranslations("common");

  const visible = errors?.filter(Boolean) ?? [];
  if (visible.length === 0) return null;

  return (
    <p id={id} role="alert" className={cn("text-xs text-destructive", className)}>
      {visible
        .map((err) =>
          typeof err === "string" && err.startsWith("validation.")
            ? tCommon(err as Parameters<typeof tCommon>[0])
            : err,
        )
        .join(", ")}
    </p>
  );
}
