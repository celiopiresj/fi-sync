"use client";

import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  createBudget,
  updateBudget,
  copyBudgetFromPreviousMonth,
  createBudgetGroup,
  updateBudgetGroup,
  deleteBudgetGroup,
} from "../actions";
import type { BudgetFormValues, BudgetGroupFormValues } from "../_schema/schema";

// Wraps budget + group mutations so components call declarative hooks
// instead of importing actions and useQueryClient directly.
export function useBudgetMutations(invalidate: () => void) {
  const createMutation = useMutation({
    mutationFn: ({ month, values }: { month: string; values: BudgetFormValues }) =>
      createBudget(month, values),
    onSuccess: (result) => {
      if (!result.error) invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      budgetId,
      values,
    }: {
      budgetId: string;
      values: BudgetFormValues;
    }) => updateBudget(budgetId, values),
    onSuccess: (result) => {
      if (!result.error) invalidate();
    },
  });

  const copyMutation = useMutation({
    mutationFn: (month: string) => copyBudgetFromPreviousMonth(month),
    onSuccess: (result) => {
      if (!result.error) invalidate();
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: (values: BudgetGroupFormValues) => createBudgetGroup(values),
    onSuccess: (result) => {
      if (!result.error) invalidate();
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({
      groupId,
      values,
    }: {
      groupId: string;
      values: BudgetGroupFormValues;
    }) => updateBudgetGroup(groupId, values),
    onSuccess: (result) => {
      if (!result.error) invalidate();
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => deleteBudgetGroup(groupId),
    onSuccess: (result) => {
      if (!result.error) invalidate();
    },
  });

  return {
    createBudget: useCallback(
      (month: string, values: BudgetFormValues) =>
        createMutation.mutateAsync({ month, values }),
      [createMutation],
    ),
    updateBudget: useCallback(
      (budgetId: string, values: BudgetFormValues) =>
        updateMutation.mutateAsync({ budgetId, values }),
      [updateMutation],
    ),
    copyFromPrevious: useCallback(
      (month: string) => copyMutation.mutateAsync(month),
      [copyMutation],
    ),
    createGroup: useCallback(
      (values: BudgetGroupFormValues) =>
        createGroupMutation.mutateAsync(values),
      [createGroupMutation],
    ),
    updateGroup: useCallback(
      (groupId: string, values: BudgetGroupFormValues) =>
        updateGroupMutation.mutateAsync({ groupId, values }),
      [updateGroupMutation],
    ),
    deleteGroup: useCallback(
      (groupId: string) => deleteGroupMutation.mutateAsync(groupId),
      [deleteGroupMutation],
    ),
    isPending:
      createMutation.isPending ||
      updateMutation.isPending ||
      copyMutation.isPending,
    isGroupPending:
      createGroupMutation.isPending ||
      updateGroupMutation.isPending ||
      deleteGroupMutation.isPending,
  };
}
