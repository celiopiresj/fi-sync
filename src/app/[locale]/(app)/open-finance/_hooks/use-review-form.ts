"use client";

import { useZodForm } from "@/lib/form/use-zod-form";
import { useState } from "react";
import { NO_CATEGORY } from "@/lib/open-finance/review";
import { reviewDefaults, reviewEditDefaults, reviewFormSchema } from "../_schema/schema";
import { useOpenFinanceMutations } from "./use-open-finance";
import type { ReviewFormProps } from "../_types/types";

export function useReviewForm(props: ReviewFormProps) {
  const { process } = useOpenFinanceMutations();
  // An in-progress edit keeps the bank snapshot the user actually saw.
  // Background refetches must not silently replace the expected values
  // and accept an upstream change without another review.
  const [review] = useState(props.review);
  const original = reviewDefaults({ ...props, review });
  const form = useZodForm(reviewFormSchema, {
    defaultValues: reviewEditDefaults({ ...props, review }),
    onSubmit: async ({ value }) => {
      try {
        const result = await process.mutateAsync({ ...original, mode: "create", edits: value, closingDate: value.closingDate, dueDate: value.dueDate });
        if (!result.error) props.onProcessed();
      } catch { /* The mutation exposes the error; retain the user's draft. */ }
    },
  });
  function resetCategory() { form.setFieldValue("categoryId", NO_CATEGORY); }
  async function decide(mode: "match" | "ignore", existingTransactionId = "") {
    try {
      const result = await process.mutateAsync({ ...original, mode, existingTransactionId });
      if (!result.error) props.onProcessed();
    } catch { /* The mutation exposes the error; retain the review queue. */ }
  }
  return { form, process, decide, resetCategory, review };
}
