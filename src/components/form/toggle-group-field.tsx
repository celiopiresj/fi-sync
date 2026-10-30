"use client";

import { useFieldContext } from "@/lib/form/form-context";
import { useShowFieldErrors } from "@/lib/form/use-show-field-errors";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
  const showErrors = useShowFieldErrors();

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <ToggleGroup
        type="single"
        variant="tabs"
        value={field.state.value}
        onValueChange={(value) => {
          if (value) field.handleChange(value);
        }}
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
      {showErrors ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          {field.state.meta.errors.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
