"use client";

import { useZodForm } from "@/lib/form/use-zod-form";
import { useOpenFinanceMutations } from "./use-open-finance";
import { mappingDefaults, mappingSchema } from "../_schema/schema";
import type { MappingFormProps } from "../_types/types";

export function useMappingForm(props: MappingFormProps) {
  const { mapping, clearMapping } = useOpenFinanceMutations();
  const form = useZodForm(mappingSchema, {
    defaultValues: mappingDefaults(props.source),
    onSubmit: async ({ value }) => {
      try { const result = await mapping.mutateAsync(value); if (!result.error) props.onReady(); }
      catch { /* Retain the editor and show the mutation's error inline. */ }
    },
  });
  async function clear() {
    try { const result = await clearMapping.mutateAsync(props.source.id); if (!result.error) props.onReady(); }
    catch { /* The mutation exposes the failure without discarding input. */ }
  }
  return {
    form, clear, pending: mapping.isPending || clearMapping.isPending,
    error: mapping.data?.error ?? clearMapping.data?.error,
    failed: mapping.isError || clearMapping.isError,
    resetCard: () => form.setFieldValue("cardId", ""),
  };
}
