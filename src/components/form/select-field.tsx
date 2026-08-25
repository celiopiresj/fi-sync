"use client";

import { useFieldContext } from "@/lib/form/form-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Registered as `SelectField` on `useAppForm`. `options[].label` is
// usually user/data-owned text (an account or category name) rather than
// UI copy, so it isn't routed through i18n — only `label`/`placeholder`
// (the field's own chrome) are, and those are required props with no
// literal default (see AGENTS.md: no hardcoded/default UI text).
type SelectFieldProps = {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
};

export function SelectField({
  label,
  placeholder,
  options,
  disabled,
}: SelectFieldProps) {
  const field = useFieldContext<string>();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={field.name} className="text-sm font-medium">
        {label}
      </label>
      <Select
        value={field.state.value || undefined}
        onValueChange={(value) => field.handleChange(value)}
        disabled={disabled || options.length === 0}
      >
        <SelectTrigger id={field.name} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          {field.state.meta.errors.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
