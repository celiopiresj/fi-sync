"use client";

import { useZodForm } from "@/lib/form/use-zod-form";
import { useState } from "react";
import type { MappingValues } from "@/lib/open-finance/schema";
import { useOpenFinanceMutations } from "./use-open-finance";
import { mappingDefaults, mappingSchema } from "../_schema/schema";
import type { MappingFormProps } from "../_types/types";

export function useMappingForm(props: MappingFormProps) {
  const { mapping, clearMapping, resolveMapping } = useOpenFinanceMutations();
  const [submitted, setSubmitted] = useState<MappingValues | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  function resetConflict() { mapping.reset(); resolveMapping.reset(); setSubmitted(null); }
  const form = useZodForm(mappingSchema, {
    defaultValues: mappingDefaults(props.source),
    onSubmit: async ({ value }) => {
      setSubmitted(value);
      try { const result = await mapping.mutateAsync(value); if (!result.error) props.onReady(); }
      catch { /* Retain the editor and show the mutation's error inline. */ }
    },
  });
  async function clear() {
    try { const result = await clearMapping.mutateAsync(props.source.id); if (!result.error) props.onReady(); }
    catch { /* The mutation exposes the failure without discarding input. */ }
  }
  const conflict = resolveMapping.data?.conflict ?? mapping.data?.conflict;
  async function resolve() {
    if (!submitted || !conflict?.canReplace) return;
    try {
      const result = await resolveMapping.mutateAsync({ ...submitted, replaceSourceId: conflict.sourceId });
      if (!result.error) { setConfirmOpen(false); props.onReady(); }
    } catch { /* Keep the failed correction visible for a retry. */ }
  }
  return {
    form, clear, resolve, conflict, confirmOpen, setConfirmOpen,
    pending: mapping.isPending || clearMapping.isPending || resolveMapping.isPending,
    error: resolveMapping.data?.error ?? mapping.data?.error ?? clearMapping.data?.error,
    failed: mapping.isError || clearMapping.isError || resolveMapping.isError,
    resetConflict, resetCard: () => { form.setFieldValue("cardId", ""); resetConflict(); },
  };
}
