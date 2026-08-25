"use client";

import { type ComponentProps, type ReactNode } from "react";
import { dinero, toDecimal, BRL } from "dinero.js";
import { useFieldContext } from "@/lib/form/form-context";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { evaluateExpression } from "@/lib/math/safe-expression";

// Snaps a raw typed value (comma-or-period decimal, or — when
// `allowExpression` — a "+ - * /" expression, same grammar the matching
// Zod schema accepts: `amountString`/`decimalString` in each route's
// _schema/schema.ts) to a clean "0,00" display on blur. Goes through
// dinero.js rather than plain `Number`/`toFixed` math per AGENTS.md's
// "Money values" convention, so the cents conversion itself can't drift
// (e.g. "30.005" rounding). Only touches the display when the result is
// unambiguously a valid positive amount — anything else (empty,
// negative, unparsable) is left exactly as typed, so the field's own
// Zod-driven error message stays the single source of truth for "this
// isn't valid" instead of the input silently rewriting it.
function applyCurrencyMask(raw: string, allowExpression: boolean): string {
  if (!raw) return "";

  // Se o campo permitir expressões e houver um operador matemático (+, -, *, /),
  // interrompe a máscara para permitir a digitação livre da conta.
  if (allowExpression && /[+\-*/]/.test(raw.trim().replace(/^-/, ""))) {
    return raw;
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  const parsed = parseInt(digits, 10);
  if (isNaN(parsed) || parsed === 0) return "";

  const amount = dinero({ amount: parsed, currency: BRL });
  return toDecimal(amount, ({ value }) => value.replace(".", ","));
}

function normalizeAmountDisplay(raw: string, allowExpression: boolean): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  const evaluated = allowExpression ? evaluateExpression(trimmed) : null;
  const parsed = evaluated ?? Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return raw;

  const amount = dinero({ amount: Math.round(parsed * 100), currency: BRL });
  return toDecimal(amount, ({ value }) => value.replace(".", ","));
}

type AmountInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  isInvalid?: boolean;
  // Splits (`decimalString`) are plain magnitudes only — see the comment
  // on that schema. The main transaction amount and batch rows
  // (`amountString`) additionally accept an expression like "120+35".
  // Gates blur-time normalization the same way, so this input never
  // "accepts" (by reformatting into a clean number) something the
  // matching schema would actually reject.
  allowExpression?: boolean;
  // The single-transaction form's amount is the drawer's hero field —
  // much larger, borderless, sitting in its own card. Splits and the
  // batch table's rows use the same footprint as every other field next
  // to them. Both still go through the same InputGroup + dinero.js path.
  size?: "default" | "lg";
} & Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "onBlur" | "size" | "type" | "placeholder"
>;

export function AmountInput({
  value,
  onChange,
  onBlur,
  placeholder,
  isInvalid,
  allowExpression = false,
  size = "default",
  ref,
  className,
  ...props
}: AmountInputProps) {
  return (
    <InputGroup
      className={cn(
        size === "lg" &&
          "h-auto items-baseline gap-1.5 border-0 bg-transparent p-0 has-[[data-slot=input-group-control]:focus-visible]:border-0 has-[[data-slot=input-group-control]:focus-visible]:ring-0",
        className,
      )}
    >
      <InputGroupAddon
        className={cn(
          size === "lg" && "pl-0 text-sm font-medium text-muted-foreground",
        )}
      >
        R$
      </InputGroupAddon>
      <InputGroupInput
        ref={ref}
        type="text"
        inputMode="decimal"
        value={value}
        aria-invalid={isInvalid || undefined}
        onChange={(e) => onChange(applyCurrencyMask(e.target.value, allowExpression))}
        onBlur={() => {
          onChange(normalizeAmountDisplay(value, allowExpression));
          onBlur?.();
        }}
        placeholder={placeholder}
        className={cn(
          "tabular-nums",
          size === "lg" &&
            "text-[28px] font-medium placeholder:text-muted-foreground/50",
        )}
        {...props}
      />
    </InputGroup>
  );
}

// Registered as `AmountField` on `useAppForm` (src/lib/form/use-app-form.ts)
// — the shared currency-input pattern AGENTS.md's "Money values"
// convention and the form-field-primitive rule both call for: every
// amount field (the single-transaction form's main amount and its split
// amounts, batch-transaction-table.tsx's row amount) gets the same R$
// prefix and dinero.js-backed blur normalization instead of each one
// hand-rolling its own `<input>`. `footer` mirrors PickerRowField's/
// ChipSelect's own `footer` prop — used by the main amount field to
// render its "= R$ X" calculated-expression preview inside the same
// card without AmountField needing to know about next-intl itself.
type AmountFieldProps = {
  label: string;
  placeholder?: string;
  allowExpression?: boolean;
  size?: "default" | "lg";
  footer?: ReactNode;
  ref?: ComponentProps<typeof AmountInput>["ref"];
  className?: string;
};

export function AmountField({
  label,
  placeholder,
  allowExpression = false,
  size = "default",
  footer,
  ref,
  className,
}: AmountFieldProps) {
  const field = useFieldContext<string>();
  const hasError =
    field.state.meta.isTouched && field.state.meta.errors.length > 0;

  if (size === "lg") {
    return (
      <div className={cn("flex flex-col gap-1 rounded-lg bg-surface-1 px-4 py-3", className)}>
        <label
          htmlFor={field.name}
          className="text-xs text-muted-foreground"
        >
          {label}
        </label>
        <AmountInput
          ref={ref}
          id={field.name}
          name={field.name}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={field.handleChange}
          placeholder={placeholder}
          isInvalid={hasError}
          allowExpression={allowExpression}
          size="lg"
        />
        {footer}
        {hasError ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {field.state.meta.errors.join(", ")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={field.name} className="text-sm font-medium">
        {label}
      </label>
      <AmountInput
        ref={ref}
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={field.handleChange}
        placeholder={placeholder}
        isInvalid={hasError}
        allowExpression={allowExpression}
      />
      {footer}
      {hasError ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          {field.state.meta.errors.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
