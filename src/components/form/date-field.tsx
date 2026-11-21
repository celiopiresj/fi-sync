"use client";

import { Input } from "@/components/ui/input";
import { useFieldContext } from "@/lib/form/form-context";
import { FieldErrors } from "./field-errors";

type DateFieldProps = {
  label: string;
};

export function DateField({ label }: DateFieldProps) {
  const field = useFieldContext<string>();
  const hasError =
    field.state.meta.isTouched && field.state.meta.errors.length > 0;
  const errorId = `${field.name}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={field.name} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={field.name}
        name={field.name}
        type="date"
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
      />
      {hasError ? (
        <FieldErrors id={errorId} errors={field.state.meta.errors} />
      ) : null}
    </div>
  );
}
