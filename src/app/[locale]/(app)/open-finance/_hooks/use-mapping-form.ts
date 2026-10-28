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
      catch { /* Retain the destination editor on failure. */ }
    },
  });
  async function clear() {
    try { const result = await clearMapping.mutateAsync(props.source.id); if (!result.error) props.onReady(); }
    catch { /* Keep input visible so the owner can retry. */ }
  }
  function resetError() { mapping.reset(); clearMapping.reset(); }
  return {
    form, clear, pending: mapping.isPending || clearMapping.isPending,
    error: mapping.data?.error ?? clearMapping.data?.error,
    failed: mapping.isError || clearMapping.isError,
    resetError, resetCard: () => { form.setFieldValue("cardId", ""); resetError(); },
  };
}
