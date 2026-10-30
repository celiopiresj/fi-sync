"use client";

import { useStore } from "@tanstack/react-form";
import { useFieldContext } from "@/lib/form/form-context";

// Whether a registered field component should render its error line.
// `isTouched` alone (the old rule) flips on the first blur, so merely
// tabbing or tapping *past* an empty required field — e.g. leaving the
// auto-focused amount to open the Conta picker — painted "Campo
// obrigatório" under it. That inserted line shifted every row below it
// down between the finger's touchstart and touchend, and the browser then
// fired the click on the rows' shared parent instead of the row that was
// tapped: on a phone the first tap after leaving a field silently did
// nothing. Errors now wait until the user actually changed the value
// (`isDirty`) or tried to submit (which also marks every field touched).
export function useShowFieldErrors(): boolean {
  const field = useFieldContext<unknown>();
  const submissionAttempts = useStore(
    field.form.store,
    (state) => state.submissionAttempts,
  );
  return shouldShowFieldErrors(field.state.meta, submissionAttempts);
}

// Same rule for a form's inline `form.AppField` render-prop fields, which
// can't call the hook above (a render prop isn't a component) — the form
// reads `submissionAttempts` from its own store and passes it in.
export function shouldShowFieldErrors(
  meta: { isTouched: boolean; isDirty: boolean; errors: unknown[] },
  submissionAttempts: number,
): boolean {
  return (
    meta.isTouched &&
    (meta.isDirty || submissionAttempts > 0) &&
    meta.errors.length > 0
  );
}
