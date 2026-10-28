"use client";

import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { PreviewRow } from "../_types/types";
import { EMPTY_PREVIEW_ROWS } from "../_constants/constants";

const column = createColumnHelper<PreviewRow>();
const columns = [column.accessor("date", {}), column.accessor("description", {}), column.accessor("amount", {})];
export function usePreviewTable(rows: PreviewRow[] = EMPTY_PREVIEW_ROWS) {
  // TanStack owns the table's mutable instance; React Compiler must not memoize it.
  // eslint-disable-next-line react-hooks/incompatible-library
  return useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), getRowId: (row) => row.id });
}
