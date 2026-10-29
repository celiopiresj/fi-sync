"use client";

import { useMemo, useState } from "react";
import { matchesSearch } from "@/lib/normalize-search";
import type { PreviewDirection, PreviewRow } from "../_types/types";
import { matchesDirection } from "../_lib/preview-money";
import { EMPTY_PREVIEW_ROWS } from "../_constants/constants";

export function usePreviewTable(rows: PreviewRow[] = EMPTY_PREVIEW_ROWS) {
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<PreviewDirection>("all");

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (!matchesDirection(row, direction)) return false;
      if (search.trim() && !matchesSearch(row.description, search)) return false;
      return true;
    });
  }, [rows, search, direction]);

  const selectableRows = useMemo(
    () => filteredRows.filter((row) => row.amount !== null),
    [filteredRows],
  );

  const selectedRows = useMemo(
    () => selectableRows.filter((row) => Boolean(selectedIds[row.id])),
    [selectableRows, selectedIds],
  );

  const isAllSelected =
    selectableRows.length > 0 && selectedRows.length === selectableRows.length;
  const isSomeSelected =
    selectedRows.length > 0 && selectedRows.length < selectableRows.length;

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = { ...prev };
      if (checked) {
        next[id] = true;
      } else {
        delete next[id];
      }
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelectedIds({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const row of selectableRows) {
      next[row.id] = true;
    }
    setSelectedIds(next);
  }

  function clearSelection() {
    setSelectedIds({});
  }

  function unselectRow(id: string) {
    setSelectedIds((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  return {
    totalRowsCount: rows.length,
    filteredRows,
    selectableRows,
    selectedRows,
    selectedIds,
    isAllSelected,
    isSomeSelected,
    toggleRow,
    toggleAll,
    clearSelection,
    unselectRow,
    search,
    direction,
    changeSearch: (value: string) => {
      setSelectedIds({});
      setSearch(value);
    },
    changeDirection: (value: string) => {
      if (value === "all" || value === "income" || value === "expense") {
        setSelectedIds({});
        setDirection(value);
      }
    },
  };
}
