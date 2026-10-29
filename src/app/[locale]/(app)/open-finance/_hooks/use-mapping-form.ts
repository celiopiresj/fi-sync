"use client";

import { useEffect, useRef } from "react";
import { useSelector } from "@tanstack/react-form";
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
  const accountId = useSelector(form.store, (state) => state.values.accountId);
  const cardId = useSelector(form.store, (state) => state.values.cardId);
  const fromDate = useSelector(form.store, (state) => state.values.fromDate);
  const previousAccountIdRef = useRef(accountId);
  useEffect(() => {
    if (previousAccountIdRef.current !== accountId) {
      previousAccountIdRef.current = accountId;
      if (cardId) {
        form.setFieldValue("cardId", "");
      }
      mapping.reset();
      clearMapping.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const previousCardAndDateRef = useRef(`${cardId}:${fromDate}`);
  useEffect(() => {
    const next = `${cardId}:${fromDate}`;
    if (previousCardAndDateRef.current !== next) {
      previousCardAndDateRef.current = next;
      mapping.reset();
      clearMapping.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, fromDate]);

  async function clear() {
    try { const result = await clearMapping.mutateAsync(props.source.id); if (!result.error) props.onReady(); }
    catch { /* Keep input visible so the owner can retry. */ }
  }
  return {
    form, accountId, clear, pending: mapping.isPending || clearMapping.isPending,
    error: mapping.data?.error ?? clearMapping.data?.error,
    failed: mapping.isError || clearMapping.isError,
  };
}
