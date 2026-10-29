"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { makeErrorMap } from "@/lib/zod/zod-error-map";
import { useOpenFinanceMutations } from "./use-open-finance";
import { mappingDefaults, mappingSchema } from "../_schema/schema";
import type { MappingFormProps } from "../_types/types";

export function useMappingForm(props: MappingFormProps) {
  const tValidation = useTranslations("common.validation");
  const { mapping, clearMapping } = useOpenFinanceMutations();
  const initial = mappingDefaults(props.source);
  const [accountId, setAccountId] = useState(initial.accountId);
  const [cardId, setCardId] = useState(initial.cardId);
  const [fromDate, setFromDate] = useState(initial.fromDate);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function resetMutations() {
    mapping.reset();
    clearMapping.reset();
  }

  function changeAccount(nextAccountId: string) {
    setAccountId(nextAccountId);
    const nextAccount = props.accounts.find((account) => account.id === nextAccountId);
    if (props.source.type === "CREDIT") {
      setCardId(nextAccount?.cards.length === 1 ? nextAccount.cards[0].id : "");
    } else {
      setCardId("");
    }
    setFieldErrors((prev) => ({ ...prev, accountId: "", cardId: "" }));
    resetMutations();
  }

  function changeCard(nextCardId: string) {
    setCardId(nextCardId);
    setFieldErrors((prev) => ({ ...prev, cardId: "" }));
    resetMutations();
  }

  function changeFromDate(nextFromDate: string) {
    setFromDate(nextFromDate);
    setFieldErrors((prev) => ({ ...prev, fromDate: "" }));
    resetMutations();
  }

  async function submit() {
    const payload = {
      sourceId: props.source.id,
      accountId,
      cardId: props.source.type === "CREDIT" ? cardId : "",
      fromDate,
    };
    const parsed = mappingSchema.safeParse(payload, {
      error: makeErrorMap(tValidation),
    });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !nextErrors[key]) nextErrors[key] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }
    if (props.source.type === "CREDIT" && !cardId) {
      setFieldErrors({ cardId: tValidation("required") });
      return;
    }
    setFieldErrors({});
    try {
      const result = await mapping.mutateAsync(parsed.data);
      if (!result.error) props.onReady();
    } catch {
      /* Retain the destination editor on failure. */
    }
  }

  async function clear() {
    try {
      const result = await clearMapping.mutateAsync(props.source.id);
      if (!result.error) props.onReady();
    } catch {
      /* Keep input visible so the owner can retry. */
    }
  }

  return {
    accountId,
    cardId,
    fromDate,
    fieldErrors,
    changeAccount,
    changeCard,
    changeFromDate,
    submit,
    clear,
    pending: mapping.isPending || clearMapping.isPending,
    error: mapping.data?.error ?? clearMapping.data?.error,
    failed: mapping.isError || clearMapping.isError,
  };
}
