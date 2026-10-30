"use client";

import { useEffect, useLayoutEffect, useRef, type ComponentProps } from "react";
import {
  AsYouType,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js";
import { useFieldContext } from "@/lib/form/form-context";
import { useShowFieldErrors } from "@/lib/form/use-show-field-errors";
import { Input } from "@/components/ui/input";

// This component is only ever rendered on the client ("use client"), but
// Next.js still renders it once on the server to produce the initial HTML.
// `useLayoutEffect` warns when that happens ("useLayoutEffect does nothing
// on the server"), so fall back to `useEffect` for that one pass — no
// behavior difference once hydrated, since the effect below only ever
// fires in response to a real keystroke.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

// Formats the value as the user types using libphonenumber-js's
// `AsYouType` (e.g. typing "5511912345678" renders as "+55 11
// 91234-5678"). A fresh `AsYouType` re-derives the format from the full
// current value on every keystroke rather than formatting incrementally —
// the pattern libphonenumber-js itself recommends for controlled inputs,
// and what makes backspace/paste reformat correctly instead of fighting
// the cursor.
//
// `defaultCountry` only matters for input typed WITHOUT a leading "+" —
// without it, `AsYouType` has no numbering plan to apply and mostly just
// echoes raw digits back unformatted (verified: "555555555555" stays
// "555555555555" with no default country, but becomes "55 55 5555 5555"
// with one, and a real number like "11987654321" becomes
// "(11) 98765-4321"). Input that does start with "+" always formats
// correctly regardless, since the country is then unambiguous. Left
// optional (not hardcoded here) so this stays reusable outside a
// Brazil-only screen — pass it from the call site.
//
// Reformatting on every keystroke replaces the whole DOM value, which by
// default snaps the caret to the end of the input. Left unmanaged, that
// means backspace always deletes whatever trailing punctuation the
// formatter just added (e.g. the ")" in "(11)") instead of a digit — and
// since removing punctuation doesn't change the digits, the formatter
// immediately adds it right back, so the field gets permanently stuck and
// can't be cleared. The `significantCharsBefore`/`indexAfterSignificantChars`
// helpers below keep the caret glued to the same *digit* across a
// reformat (counting only digits and a leading "+", since those are the
// only characters libphonenumber-js keeps — punctuation is free to move
// around it), so backspace always lands next to a real digit and keeps
// making progress instead of looping.
function significantCharsBefore(value: string, index: number): number {
  let count = 0;
  for (let i = 0; i < index && i < value.length; i++) {
    if (/[\d+]/.test(value[i])) count++;
  }
  return count;
}

function indexAfterSignificantChars(value: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < value.length; i++) {
    if (/[\d+]/.test(value[i])) {
      seen += 1;
      if (seen === count) return i + 1;
    }
  }
  return value.length;
}

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  defaultCountry?: CountryCode;
} & Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "onBlur" | "type" | "placeholder"
>;

// Registered as `PhoneField` on `useAppForm` below wraps this — same
// TanStack-bound/plain split as `AmountField`/`AmountInput`
// (src/components/form/amount-field.tsx), so a screen with local state
// instead of a TanStack Form (e.g. the onboarding wizard's hand-rolled
// steps) still gets live AsYouType formatting without needing a form
// context.
export function PhoneInput({
  value,
  onChange,
  onBlur,
  placeholder,
  defaultCountry,
  ref,
  ...props
}: PhoneInputProps) {
  const pendingCaret = useRef<{ node: HTMLInputElement; position: number } | null>(
    null,
  );

  // Runs after the reformatted value has committed to the DOM (but before
  // paint), so the caret jump-to-end never becomes visible. No-ops unless
  // `onChange` just scheduled a restore, so external value changes (e.g.
  // loading `initialValues` into the form) are left alone.
  useIsomorphicLayoutEffect(() => {
    const pending = pendingCaret.current;
    if (!pending) return;
    pending.node.setSelectionRange(pending.position, pending.position);
    pendingCaret.current = null;
  }, [value]);

  return (
    <Input
      ref={ref}
      type="tel"
      value={value}
      onBlur={onBlur}
      onChange={(e) => {
        const node = e.target;
        const raw = node.value;
        const caret = node.selectionStart ?? raw.length;
        const significantBefore = significantCharsBefore(raw, caret);

        const formatted = new AsYouType(defaultCountry).input(raw);

        // Once the number is already at its maximum possible length for
        // the numbering plan in play, reject any keystroke that would
        // add more digits — the field snaps back to its previous value
        // (React resets the DOM to the unchanged `value` prop on the
        // next render, since this is a controlled input and `onChange`
        // is never called below), so it's not just "invalid," it's
        // literally impossible to type past a valid number. Checked via
        // digit COUNT rather than string length so a reformat that just
        // adds/removes punctuation isn't mistaken for growth, and only
        // ever blocks growth — deleting/editing mid-number is untouched.
        const digitsBefore = (value.match(/\d/g) ?? []).length;
        const digitsAfter = (formatted.match(/\d/g) ?? []).length;
        if (
          digitsAfter > digitsBefore &&
          validatePhoneNumberLength(formatted, defaultCountry) === "TOO_LONG"
        ) {
          return;
        }

        pendingCaret.current = {
          node,
          position: indexAfterSignificantChars(formatted, significantBefore),
        };
        onChange(formatted);
      }}
      placeholder={placeholder}
      {...props}
    />
  );
}

// Registered as `PhoneField` on `useAppForm` (src/lib/form/use-app-form.ts).
// Same shape as `TextField`, but delegates the actual formatting to
// `PhoneInput` above.
type PhoneFieldProps = {
  label: string;
  placeholder?: string;
  defaultCountry?: CountryCode;
};

export function PhoneField({
  label,
  placeholder,
  defaultCountry,
}: PhoneFieldProps) {
  const field = useFieldContext<string>();
  const showErrors = useShowFieldErrors();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={field.name} className="text-sm font-medium">
        {label}
      </label>
      <PhoneInput
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={field.handleChange}
        placeholder={placeholder}
        defaultCountry={defaultCountry}
      />
      {showErrors ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          {field.state.meta.errors.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
