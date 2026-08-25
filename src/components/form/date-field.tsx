"use client";

import { useFieldContext } from "@/lib/form/form-context";
import { Input } from "@/components/ui/input";

type DateFieldProps = {
  label: string;
};

export function DateField({ label }: DateFieldProps) {
  const field = useFieldContext<string>();

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
      />
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          {field.state.meta.errors.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
