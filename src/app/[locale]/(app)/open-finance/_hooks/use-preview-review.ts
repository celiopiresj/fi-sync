"use client";

import { useState } from "react";
import { useOpenFinanceTransactions } from "./use-open-finance";
import { usePreviewTable } from "./use-preview-table";
import { selectedPreviewTotal } from "../_lib/preview-money";
import type { PreviewRow, Source } from "../_types/types";

export function usePreviewReview(source: Source) {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [queue, setQueue] = useState<PreviewRow[]>([]);
  const query = useOpenFinanceTransactions(
    source.id,
    cursors[cursors.length - 1],
  );
  const filters = usePreviewTable(query.data?.data?.rows);

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

  return {
    query,
    ...filters,
    row: queue[0] ?? null,
    remaining: queue.length,
    hasPrevious: cursors.length > 1,
    page: cursors.length,
    selectedCount: filters.selectedRows.length,
    selectedTotal: selectedPreviewTotal(filters.selectedRows),
    reviewSelected: () => setQueue(filters.selectedRows),
    reviewRow: (row: PreviewRow) => setQueue([row]),
    close: () => setQueue([]),
    processed,
    nextPage,
    previousPage,
  };
}
