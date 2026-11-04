"use client";

import { useState } from "react";
import { todayCalendarDate } from "@/lib/date";
import { importMonths } from "@/lib/open-finance/months";
import { useMarkExisting, useOpenFinanceMonthCounts, useOpenFinanceTransactions } from "./use-open-finance";
import { usePreviewTable } from "./use-preview-table";
import { groupRowsByDay, previewSummary, selectedPreviewTotal } from "../_lib/preview-money";
import type { PreviewRow, Source } from "../_types/types";

export function usePreviewReview(source: Source) {
  const [months] = useState(() => importMonths(source.fromDate ?? todayCalendarDate(), todayCalendarDate(), source.type));
  const [month, setMonth] = useState(months[0]);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [queue, setQueue] = useState<PreviewRow[]>([]);
  const query = useOpenFinanceTransactions(source.id, month, cursors[cursors.length - 1]);
  const counts = useOpenFinanceMonthCounts(source.id, months);
  const filters = usePreviewTable(query.data?.data?.rows);
  const mark = useMarkExisting(source);
  const [confirmingExisting, setConfirmingExisting] = useState(false);

  function processed() {
    const id = queue[0]?.id;
    if (id) filters.unselectRow(id);
    setQueue((previous) => previous.slice(1));
  }

  function nextPage() {
    const next = query.data?.data?.next;
    if (!next) return;
    filters.clearSelection();
    setCursors((previous) => [...previous, next]);
  }

  function previousPage() {
    filters.clearSelection();
    setCursors((previous) => previous.slice(0, -1));
  }

  function changeMonth(value: string) {
    if (!value || value === month || !months.includes(value)) return;
    filters.clearSelection();
    setCursors([null]);
    setMonth(value);
  }

  function confirmExisting() {
    mark.mutate(filters.selectedRows, { onSettled: () => { filters.clearSelection(); setConfirmingExisting(false); } });
  }

  return {
    query,
    ...filters,
    month,
    months: counts,
    changeMonth,
    days: groupRowsByDay(filters.filteredRows),
    summary: previewSummary(query.data?.data?.rows ?? []),
    row: queue[0] ?? null,
    remaining: queue.length,
    hasPrevious: cursors.length > 1,
    hasNext: Boolean(query.data?.data?.next),
    page: cursors.length,
    selectedCount: filters.selectedRows.length,
    selectedTotal: selectedPreviewTotal(filters.selectedRows),
    reviewSelected: () => setQueue(filters.selectedRows),
    reviewRow: (row: PreviewRow) => setQueue([row]),
    close: () => setQueue([]),
    processed,
    marking: mark.isPending,
    markRow: (row: PreviewRow) => mark.mutate([row]),
    confirmingExisting,
    setConfirmingExisting,
    confirmExisting,
    selectedLinkedCount: filters.selectedRows.filter((row) => row.existing).length,
    nextPage,
    previousPage,
  };
}
