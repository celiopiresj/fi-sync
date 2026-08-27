import { createFormHookContexts } from "@tanstack/react-form";

// Shared context TanStack Form's "compose" pattern needs to connect
// `useAppForm()` (src/lib/form/use-app-form.ts) with the field/form
// components that read it via `useFieldContext`/`useFormContext`
// (src/components/form/*). Kept in its own file because both sides
// import it independently — see the TanStack Form docs on
// `createFormHookContexts`/`createFormHook`.
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();
