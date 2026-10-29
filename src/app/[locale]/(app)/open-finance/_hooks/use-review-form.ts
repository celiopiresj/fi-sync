"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSelector } from "@tanstack/react-form";
import { useZodForm } from "@/lib/form/use-zod-form";
import { centsToAmountString, parseAmountLoose, toCents } from "../_lib/split-math";
import { refineReviewForm, reviewDefaults, reviewEditDefaults, reviewFormSchema } from "../_schema/schema";
import { useOpenFinanceMutations } from "./use-open-finance";
import type { ReviewFormProps } from "../_types/types";

export function useReviewForm(props: ReviewFormProps) {
  const t = useTranslations("scrn-open-finance");
  const tValidation = useTranslations("common.validation");
  const { process, createPerson } = useOpenFinanceMutations();
  // An in-progress edit keeps the bank snapshot the user actually saw.
  // Background refetches must not silently replace the expected values
  // and accept an upstream change without another review.
  const [review] = useState(props.review);
  const [people, setPeople] = useState(props.review.people);
  const [isDividing, setIsDividing] = useState(false);
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const original = reviewDefaults({ ...props, review });

  const schema = useMemo(
    () =>
      reviewFormSchema.superRefine((value, ctx) =>
        refineReviewForm(value, ctx, {
          credit: review.credit,
          hasPeople: people.length > 0,
          messages: {
            required: tValidation("required"),
            splitsMismatch: t("splits.mismatch"),
          },
        }),
      ),
    [review.credit, people.length, t, tValidation],
  );

  const form = useZodForm(schema, {
    defaultValues: reviewEditDefaults({ ...props, review }),
    onSubmit: async ({ value }) => {
      try {
        const result = await process.mutateAsync({ ...original, mode: "create", edits: value, closingDate: value.closingDate, dueDate: value.dueDate });
        if (!result.error) props.onProcessed();
      } catch { /* The mutation exposes the error; retain the user's draft. */ }
    },
  });

  const type = useSelector(form.store, (state) => state.values.type);
  const existingId = useSelector(form.store, (state) => state.values.existingTransactionId);
  const personId = useSelector(form.store, (state) => state.values.personId);
  const splits = useSelector(form.store, (state) => state.values.splits);
  const amount = useSelector(form.store, (state) => state.values.amount);
  const description = useSelector(form.store, (state) => state.values.description);
  const date = useSelector(form.store, (state) => state.values.date);
  const categoryId = useSelector(form.store, (state) => state.values.categoryId);
  const paymentMethod = useSelector(form.store, (state) => state.values.paymentMethod);
  const isTouched = useSelector(form.store, (state) => state.isTouched);

  const parsedAmount = parseAmountLoose(amount);
  const totalCents = toCents(parsedAmount);
  const secondaries = splits.slice(1);
  const secondaryCentsList = secondaries.map((split) =>
    toCents(parseAmountLoose(split.amount)),
  );
  const secondaryCentsSum = secondaryCentsList.reduce((sum, c) => sum + c, 0);
  const primaryAmountCents = totalCents - secondaryCentsSum;
  const primaryAmountDisplay = centsToAmountString(
    Math.max(primaryAmountCents, 0),
  );
  const isOverAllocated = primaryAmountCents < 0;
  const primaryPerson = people.find((person) => person.id === personId);
  const sign = type === "expense" ? -1 : 1;

  useEffect(() => {
    if (isDividing) {
      if (splits.length === 0) {
        form.setFieldValue("splits", [
          { personId, amount: centsToAmountString(totalCents) },
        ]);
      }
    } else if (splits.length > 0) {
      form.setFieldValue("splits", []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDividing]);

  useEffect(() => {
    if (!isDividing) return;
    if (splits[0]?.personId !== personId) {
      form.setFieldValue("splits[0].personId", personId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, isDividing]);

  useEffect(() => {
    if (!isDividing) return;
    const next = centsToAmountString(primaryAmountCents);
    if (splits[0]?.amount !== next) {
      form.setFieldValue("splits[0].amount", next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryAmountCents, isDividing]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (splits.length <= 1) return;
    const peopleCount = splits.length;
    const share = Math.floor(totalCents / peopleCount);
    const shareStr = centsToAmountString(share);
    for (let i = 1; i < splits.length; i++) {
      form.setFieldValue(`splits[${i}].amount`, shareStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCents]);

  useEffect(() => {
    if (secondaries.length !== 1) return;
    const maxCents = Math.max(totalCents - 1, 0);
    if (secondaryCentsList[0] > maxCents) {
      const clamped = centsToAmountString(maxCents);
      if (splits[1]?.amount !== clamped) {
        form.setFieldValue("splits[1].amount", clamped);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCents, secondaryCentsList[0], secondaries.length]);

  function handleAddSecondaryPerson(newPersonId = "") {
    const peopleCountBefore = splits.length;
    const shareBefore =
      peopleCountBefore > 0 ? Math.floor(totalCents / peopleCountBefore) : 0;
    const isPristine = secondaryCentsList.every((cents) => cents === shareBefore);

    if (isPristine) {
      const peopleCountAfter = peopleCountBefore + 1;
      const shareAfter = Math.floor(totalCents / peopleCountAfter);
      const shareAfterStr = centsToAmountString(shareAfter);
      for (let i = 1; i < splits.length; i++) {
        form.setFieldValue(`splits[${i}].amount`, shareAfterStr);
      }
      form.pushFieldValue("splits", { personId: newPersonId, amount: shareAfterStr });
    } else {
      form.pushFieldValue("splits", { personId: newPersonId, amount: "0,00" });
    }
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
          : [...prev, { ...created, isSelf: false }].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewPersonName("");
      setIsAddingPerson(false);
      if (isDividing) {
        handleAddSecondaryPerson(created.id);
      } else {
        form.setFieldValue("personId", created.id);
      }
    } catch { /* Handled by mutation */ }
  }

  function resetCategory() { form.setFieldValue("categoryId", ""); }
  async function decide(mode: "match" | "ignore", existingTransactionId = "") {
    try {
      const result = await process.mutateAsync({ ...original, mode, existingTransactionId });
      if (!result.error) props.onProcessed();
    } catch { /* The mutation exposes the error; retain the review queue. */ }
  }

  const missingFieldLabel = !description.trim()
    ? t("fields.description.label")
    : !date
      ? t("fields.date.label")
      : !amount
        ? t("fields.amount.label")
        : !categoryId
          ? t("fields.category.label")
          : !review.credit && !paymentMethod
            ? t("fields.paymentMethod.label")
            : people.length > 0 && !personId
              ? t("fields.person.label")
              : null;

  return {
    form,
    type,
    existingId,
    personId,
    people,
    isDividing,
    setIsDividing,
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
    process,
    decide,
    resetCategory,
    review,
  };
}
