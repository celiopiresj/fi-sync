"use client";

import { useState } from "react";
import { createColumnHelper, getCoreRowModel, getFilteredRowModel, useReactTable, type RowSelectionState } from "@tanstack/react-table";
import type { PreviewDirection, PreviewRow } from "../_types/types";
import { matchesDirection } from "../_lib/preview-money";
import { EMPTY_PREVIEW_ROWS } from "../_constants/constants";

const column = createColumnHelper<PreviewRow>();
const columns = [column.accessor("date", { enableGlobalFilter: false }), column.accessor("description", {}), column.accessor("amount", { enableGlobalFilter: false, filterFn: (row, _id, direction: PreviewDirection) => matchesDirection(row.original, direction) })];
export function usePreviewTable(rows: PreviewRow[] = EMPTY_PREVIEW_ROWS) {
  const [rowSelection, onRowSelectionChange] = useState<RowSelectionState>({});
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<PreviewDirection>("all");
  // TanStack owns the table's mutable instance; React Compiler must not memoize it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getRowId: (row) => row.id,
    state: { rowSelection, globalFilter: search, columnFilters: direction === "all" ? [] : [{ id: "amount", value: direction }] }, globalFilterFn: "includesString",
    onRowSelectionChange, enableRowSelection: (row) => row.original.amount !== null,
  });
  return {
    table, search, direction,
    changeSearch: (value: string) => { table.resetRowSelection(); setSearch(value); },
    changeDirection: (value: string) => { if (value === "all" || value === "income" || value === "expense") { table.resetRowSelection(); setDirection(value); } },
  };
}
