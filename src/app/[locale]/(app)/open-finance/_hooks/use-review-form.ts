"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { makeErrorMap } from "@/lib/zod/zod-error-map";
import { centsToAmountString, parseAmountLoose, toCents } from "../_lib/split-math";
import {
  refineReviewForm,
  reviewDefaults,
  reviewEditDefaults,
  reviewFormSchema,
  type ReviewFormValues,
} from "../_schema/schema";
import { useOpenFinanceMutations } from "./use-open-finance";
import type { ReviewFormProps } from "../_types/types";

export function useReviewForm(props: ReviewFormProps) {
  const t = useTranslations("scrn-open-finance");
  const tValidation = useTranslations("common.validation");
  const { process, createPerson } = useOpenFinanceMutations();

  // Keep the bank snapshot the user opened the sheet with so background
  // refetches cannot silently overwrite expected values mid-review.
  const [review, setReview] = useState(props.review);
  const [people, setPeople] = useState(props.review.people);
  const [draft, setDraft] = useState<ReviewFormValues>(() =>
    reviewEditDefaults({ ...props, review }),
  );
  const [prevServerMatchesCount, setPrevServerMatchesCount] = useState(
    props.review.matches.length,
  );
  const [prevServerDates, setPrevServerDates] = useState(
    `${props.review.closingDate}:${props.review.dueDate}`,
  );
  const nextServerDates = `${props.review.closingDate}:${props.review.dueDate}`;
  if (
    props.review.matches.length !== prevServerMatchesCount ||
    nextServerDates !== prevServerDates
  ) {
    setPrevServerMatchesCount(props.review.matches.length);
    setPrevServerDates(nextServerDates);
    setReview((current) => ({
      ...current,
      matches: props.review.matches,
      closingDate: props.review.closingDate || current.closingDate,
      dueDate: props.review.dueDate || current.dueDate,
    }));
    setDraft((current) => ({
      ...current,
      closingDate: current.closingDate || props.review.closingDate,
      dueDate: current.dueDate || props.review.dueDate,
    }));
  }
  const [isDividing, setIsDividing] = useState(false);
  const [secondaries, setSecondaries] = useState<
    { personId: string; amount: string }[]
  >([]);
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isTouched, setIsTouched] = useState(false);

  const original = reviewDefaults({ ...props, review });

  const parsedAmount = parseAmountLoose(draft.amount);
  const totalCents = toCents(parsedAmount);
  const secondaryCentsList = secondaries.map((split) =>
    toCents(parseAmountLoose(split.amount)),
  );
  const secondaryCentsSum = secondaryCentsList.reduce((sum, c) => sum + c, 0);
  const primaryAmountCents = totalCents - secondaryCentsSum;
  const primaryAmountDisplay = centsToAmountString(
    Math.max(primaryAmountCents, 0),
  );
  const isOverAllocated = primaryAmountCents < 0;
  const primaryPerson = people.find((person) => person.id === draft.personId);
  const sign = draft.type === "expense" ? -1 : 1;

  function clearError(key: string) {
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  }

  function updateField<K extends keyof ReviewFormValues>(
    key: K,
    value: ReviewFormValues[K],
  ) {
    setIsTouched(true);
    clearError(String(key));
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function updateType(nextType: "expense" | "income") {
    setIsTouched(true);
    clearError("type");
    clearError("categoryId");
    setDraft((prev) => {
      if (prev.type === nextType) return prev;
      return {
        ...prev,
        type: nextType,
        categoryId: "",
      };
    });
  }

  function updateAmount(nextAmount: string) {
    setIsTouched(true);
    clearError("amount");
    clearError("splits");
    setDraft((prev) => ({ ...prev, amount: nextAmount }));
    if (isDividing && secondaries.length > 0) {
      const nextTotalCents = toCents(parseAmountLoose(nextAmount));
      const peopleCount = secondaries.length + 1;
      const share = Math.floor(nextTotalCents / peopleCount);
      const shareStr = centsToAmountString(share);
      setSecondaries((prev) =>
        prev.map((split) => ({ ...split, amount: shareStr })),
      );
    }
  }

  function toggleDividing(nextDividing: boolean) {
    setIsTouched(true);
    clearError("splits");
    setIsDividing(nextDividing);
    if (!nextDividing) {
      setSecondaries([]);
    }
  }

  function handleAddSecondaryPerson(newPersonId = "") {
    setIsTouched(true);
    clearError("splits");
    const peopleCountBefore = secondaries.length + 1;
    const shareBefore =
      peopleCountBefore > 0 ? Math.floor(totalCents / peopleCountBefore) : 0;
    const isPristine = secondaryCentsList.every((cents) => cents === shareBefore);

    if (isPristine) {
      const peopleCountAfter = peopleCountBefore + 1;
      const shareAfter = Math.floor(totalCents / peopleCountAfter);
      const shareAfterStr = centsToAmountString(shareAfter);
      setSecondaries((prev) => [
        ...prev.map((item) => ({ ...item, amount: shareAfterStr })),
        { personId: newPersonId, amount: shareAfterStr },
      ]);
    } else {
      setSecondaries((prev) => [
        ...prev,
        { personId: newPersonId, amount: "0,00" },
      ]);
    }
  }

  function updateSecondaryPerson(index: number, nextPersonId: string) {
    setIsTouched(true);
    clearError("splits");
    setSecondaries((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, personId: nextPersonId } : item,
      ),
    );
  }

  function updateSecondaryAmount(index: number, nextAmount: string) {
    setIsTouched(true);
    clearError("splits");
    setSecondaries((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (prev.length === 1) {
          const maxCents = Math.max(totalCents - 1, 0);
          const candidateCents = toCents(parseAmountLoose(nextAmount));
          if (candidateCents > maxCents) {
            return { ...item, amount: centsToAmountString(maxCents) };
          }
        }
        return { ...item, amount: nextAmount };
      }),
    );
  }

  function removeSecondaryPerson(index: number) {
    setIsTouched(true);
    clearError("splits");
    setSecondaries((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleCreatePerson() {
    const trimmed = newPersonName.trim();
    if (!trimmed) return;
    try {
      const result = await createPerson.mutateAsync(trimmed);
      if (result.error || !result.person) return;
      const created = result.person;
      setPeople((prev) =>
        prev.some((p) => p.id === created.id)
          ? prev
          : [...prev, { ...created, isSelf: false }].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
      );
      setNewPersonName("");
      setIsAddingPerson(false);
      if (isDividing) {
        handleAddSecondaryPerson(created.id);
      } else {
        updateField("personId", created.id);
      }
    } catch {
      /* Handled by mutation */
    }
  }

  function buildPayload(): ReviewFormValues {
    const builtSplits =
      isDividing && secondaries.length > 0
        ? [
            {
              personId: draft.personId,
              amount: centsToAmountString(Math.max(primaryAmountCents, 0)),
            },
            ...secondaries,
          ]
        : [];
    return {
      ...draft,
      splits: builtSplits,
    };
  }

  async function submit() {
    setIsTouched(true);
    const candidate = buildPayload();
    const schema = reviewFormSchema.superRefine((value, ctx) =>
      refineReviewForm(value, ctx, {
        credit: review.credit,
        hasPeople: people.length > 0,
        messages: {
          required: tValidation("required"),
          splitsMismatch: t("splits.mismatch"),
        },
      }),
    );
    const parsed = schema.safeParse(candidate, {
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
    if (isDividing && isOverAllocated) {
      setFieldErrors({ splits: t("splits.mismatch") });
      return;
    }
    setFieldErrors({});
    try {
      const result = await process.mutateAsync({
        ...original,
        mode: "create",
        edits: parsed.data,
        closingDate: parsed.data.closingDate,
        dueDate: parsed.data.dueDate,
      });
      if (!result.error) props.onProcessed();
    } catch {
      /* Mutation exposes error; retain draft */
    }
  }

  async function decide(mode: "match" | "ignore", existingTransactionId = "") {
    try {
      const result = await process.mutateAsync({
        ...original,
        mode,
        existingTransactionId,
      });
      if (!result.error) props.onProcessed();
    } catch {
      /* Retain queue on error */
    }
  }

  const missingFieldLabel = !draft.description.trim()
    ? t("fields.description.label")
    : !draft.date
      ? t("fields.date.label")
      : !draft.amount
        ? t("fields.amount.label")
        : !draft.categoryId
          ? t("fields.category.label")
          : !review.credit && !draft.paymentMethod
            ? t("fields.paymentMethod.label")
            : people.length > 0 && !draft.personId
              ? t("fields.person.label")
              : null;

  return {
    draft,
    fieldErrors,
    people,
    isDividing,
    toggleDividing,
    secondaries,
    primaryPerson,
    primaryAmountDisplay,
    primaryAmountCents,
    isOverAllocated,
    sign,
    missingFieldLabel,
    isTouched,
    isAddingPerson,
    setIsAddingPerson,
    newPersonName,
    setNewPersonName,
    isCreatingPerson: createPerson.isPending,
    handleCreatePerson,
    handleAddSecondaryPerson,
    updateField,
    updateType,
    updateAmount,
    updateSecondaryPerson,
    updateSecondaryAmount,
    removeSecondaryPerson,
    submit,
    process,
    decide,
    review,
  };
}
