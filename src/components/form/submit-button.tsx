"use client";

import type { ReactNode } from "react";
import { SpinnerIcon } from "@phosphor-icons/react";
import { useFormContext } from "@/lib/form/form-context";
import { cn } from "@/lib/utils";

// Registered as `SubmitButton` on `useAppForm`. Handles the
// canSubmit/isSubmitting subscription internally — call sites just do:
//
//   <form.AppForm>
//     <form.SubmitButton label={t("buttons.submit")} submittingLabel={t("buttons.submitting")} />
//   </form.AppForm>
type SubmitButtonProps = {
  label: string;
  submittingLabel?: string;
  // Trailing icon shown after the label (e.g. the arrow on the auth
  // screens' submit buttons) — hidden while submitting so it doesn't
  // compete with the spinner.
  icon?: ReactNode;
  className?: string;
};

export function SubmitButton({
  label,
  submittingLabel,
  icon,
  className,
}: SubmitButtonProps) {
  const form = useFormContext();

  return (
    <form.Subscribe
      selector={(state) => [state.canSubmit, state.isSubmitting] as const}
    >
      {([canSubmit, isSubmitting]) => (
        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-60",
            className,
          )}
        >
          {/* Same spinner glyph as the toast loading state
              (components/ui/sonner.tsx) — the established "something is
              in flight" affordance in this codebase, reused here instead
              of relying on the disabled state alone (barely visible)
              or the label swap alone (invisible when submittingLabel
              isn't passed — see AGENTS.md: no default/fallback UI text,
              so a caller that skips it should still get a clear signal). */}
          {isSubmitting && <SpinnerIcon className="size-4 animate-spin" />}
          {isSubmitting ? (submittingLabel ?? label) : label}
          {!isSubmitting && icon}
        </button>
      )}
    </form.Subscribe>
  );
}
