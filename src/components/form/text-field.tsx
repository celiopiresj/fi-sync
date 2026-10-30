"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useFieldContext } from "@/lib/form/form-context";
import { useShowFieldErrors } from "@/lib/form/use-show-field-errors";
import { Input } from "@/components/ui/input";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { FieldErrors } from "./field-errors";

// Registered as `TextField` on `useAppForm` (src/lib/form/use-app-form.ts).
// Reads the field straight from context — no `field` prop to pass in, no
// error-array plumbing at the call site:
//
//   <form.AppField name="email">
//     {(field) => <field.TextField label={t("fields.email.label")} type="email" />}
//   </form.AppField>
type TextFieldProps = {
  label: string;
  type?: "text" | "email" | "password" | "tel" | "number";
  placeholder?: string;
  disabled?: boolean;
  // Rendered next to the label (e.g. a "forgot password?" link) — only
  // the password field on the sign-in screen uses this today.
  labelAction?: ReactNode;
  // No sensible default to infer, especially for "password" — the browser
  // needs to know "current-password" (sign-in) vs "new-password" (sign-up/
  // reset) vs plain "email"/"name", and only the call site knows which.
  // Left unset, the browser falls back to guessing from the field's name/
  // type, which is exactly the DOM warning ("Input elements should have
  // autocomplete attributes") this prop exists to silence.
  autoComplete?: string;
};

export function TextField({
  label,
  type = "text",
  placeholder,
  disabled,
  labelAction,
  autoComplete,
}: TextFieldProps) {
  const field = useFieldContext<string>();
  const showErrors = useShowFieldErrors();
  const tCommon = useTranslations("common");
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === "password";
  const resolvedType = isPassword && showPassword ? "text" : type;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={field.name} className="text-sm font-medium">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          id={field.name}
          name={field.name}
          type={resolvedType}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          className={isPassword ? "pr-9" : undefined}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
            aria-label={
              showPassword
                ? tCommon("form.hidePassword")
                : tCommon("form.showPassword")
            }
          >
            {showPassword ? (
              <EyeSlashIcon className="size-4" />
            ) : (
              <EyeIcon className="size-4" />
            )}
          </button>
        )}
      </div>
      {showErrors ? (
        <FieldErrors errors={field.state.meta.errors} />
      ) : null}
    </div>
  );
}
