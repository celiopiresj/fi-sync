"use client";

import type * as z from "zod";
import { useAppForm } from "./use-app-form";
import { useZodValidator } from "@/lib/zod/use-zod-validator";

// Extract the base options, omitting validators since we provide them
type BaseOptions = Omit<Parameters<typeof useAppForm>[0], "validators">;

// Combines `useAppForm` with `useZodValidator` so pages don't wire up
// `validators.onChange` by hand on every form — just pass the schema:
//
//   const form = useZodForm(signInSchema, {
//     defaultValues: { email: "", password: "" },
//     onSubmit: async ({ value }) => { ... },
//   });
//
// `useZodValidator` already translates Zod's issues through
// `common.validation` (see src/lib/zod/zod-error-map.ts), so per-field
// error messages show up in `field.TextField` with no extra mapping at
// the call site.
export function useZodForm<
  TSchema extends z.ZodType,
  TData = z.infer<TSchema>
>(
  schema: TSchema,
  options: Omit<BaseOptions, "defaultValues" | "onSubmit"> & {
    defaultValues: TData;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSubmit?: (context: { value: TData; formApi: any }) => void | Promise<void>;
  },
) {
  const zodValidatorFn = useZodValidator(schema);

  // We cast to `any` on the options to bypass the complex FormOptions generic
  // requirements, but we cast the return type to the generic version of
  // useAppForm so the caller still gets strong typing for TData.
  return useAppForm({
    ...options,
    validators: { onChange: zodValidatorFn },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as ReturnType<
    typeof useAppForm<
      TData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >
  >;
}
