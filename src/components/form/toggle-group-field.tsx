"use client";

import { useFieldContext } from "@/lib/form/form-context";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FieldErrors } from "./field-errors";

// Registered as `ToggleGroupField` on `useAppForm` — single-select
// segmented control (e.g. income/expense) bound to a field, same
// contract as the other field components (label required, no default
// text, reads errors straight from field state).
type ToggleGroupFieldProps = {
  label: string;
  options: { value: string; label: string }[];
};

export function ToggleGroupField({ label, options }: ToggleGroupFieldProps) {
  const field = useFieldContext<string>();
  const hasError =
    field.state.meta.isTouched && field.state.meta.errors.length > 0;
  const labelId = `${field.name}-label`;
  const errorId = `${field.name}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <ToggleGroup
        type="single"
        variant="tabs"
        value={field.state.value}
        onValueChange={(value) => {
          if (value) field.handleChange(value);
        }}
        aria-labelledby={labelId}
        aria-describedby={hasError ? errorId : undefined}
        className="w-full"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="flex-1"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {hasError ? (
        <FieldErrors id={errorId} errors={field.state.meta.errors} />
      ) : null}
    </div>
  );
}
