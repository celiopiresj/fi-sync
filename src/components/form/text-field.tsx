"use client";

import { useFieldContext } from "@/lib/form/form-context";
import { Input } from "@/components/ui/input";
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
};

export function TextField({
  label,
  type = "text",
  placeholder,
  disabled,
}: TextFieldProps) {
  const field = useFieldContext<string>();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={field.name} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={field.name}
        name={field.name}
        type={type}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {field.state.meta.isTouched ? (
        <FieldErrors errors={field.state.meta.errors} />
      ) : null}
    </div>
  );
}
