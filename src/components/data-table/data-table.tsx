"use client";

import { useMemo, useState } from "react";
import type {
  ColumnDef,
  ExpandedState,
  OnChangeFn,
  Row,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import { CaretDownIcon, CaretRightIcon, CaretUpIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Generic TanStack Table + shadcn Table wrapper — first table in the
// project (see tasks/004-transactions-screen.md); reuse this for any
// future tabular screen instead of writing another one from scratch.
//
// Sorting: on by default for every column (set `enableSorting: false` on
// a column's def to opt it out, e.g. an actions column). Clicking a
// header cycles asc -> desc -> none.
//
// Grouping: pass `groupBy` (a single column id) to cluster rows under a
// full-width, collapsible header row instead of one row per record —
// `renderGroupHeader` renders that header's content. The grouping
// column itself is hidden entirely (no header, no per-row cell), since
// its value is constant within a group and the header above already
// shows it — the column definition still needs to exist (with a matching
// `id`/`accessorKey`) purely so TanStack Table has something to group by.
//
// Selection: pass `selection` to turn on a leading checkbox column
// (header select-all, incl. an indeterminate state; one checkbox per
// row) plus a bulk-actions bar that takes over the header row while
// anything is selected — `renderBulkActions` renders that bar's content.
// Needs a stable `getRowId`: without one, TanStack Table keys selection
// by row INDEX, which silently reassigns selection to the wrong rows
// after a refetch/sort/insert. Grouped rows (see groupBy above) are
// never selectable — only real leaf/data rows are. `selectedIds` is a
// plain Set<string> rather than TanStack's own {[id]: boolean}
// `RowSelectionState` map, since a Set of ids is what a bulk Server
// Action call actually wants — this component converts between the two
// at the boundary so the caller never has to know TanStack's shape.
type SelectionConfig = {
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
  renderBulkActions: (selectedIds: Set<string>) => ReactNode;
  selectAllLabel: string;
  selectRowLabel: string;
};

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  emptyState: ReactNode;
  groupBy?: string;
  renderGroupHeader?: (row: Row<TData>) => ReactNode;
  getRowId?: (row: TData) => string;
  selection?: SelectionConfig;
};

export function DataTable<TData>({
  columns,
  data,
  emptyState,
  groupBy,
  renderGroupHeader,
  getRowId,
  selection,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  // Groups start fully expanded (`true` is TanStack's shorthand for "all
  // expanded") — matches a plain, ungrouped table's look until the user
  // actually collapses something.
  const [expanded, setExpanded] = useState<ExpandedState>(true);

  const rowSelection: RowSelectionState = useMemo(() => {
    if (!selection) return {};
    return Object.fromEntries([...selection.selectedIds].map((id) => [id, true]));
  }, [selection]);

  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    if (!selection) return;
    const next = typeof updater === "function" ? updater(rowSelection) : updater;
    selection.onSelectedIdsChange(
      new Set(
        Object.entries(next)
          .filter(([, isSelected]) => isSelected)
          .map(([id]) => id),
      ),
    );
  };

  // Prepended ahead of the caller's own columns so it always renders as
  // the leading cell. Memoized (keyed on the caller's columns + whether/
  // how selection is configured) so the columns array's identity stays
  // stable across renders that don't actually change it — `useReactTable`
  // treats a new `columns` reference as a schema change and invalidates
  // its internal column-derived memoization every time.
  const tableColumns = useMemo(() => {
    if (!selection) return columns;
    const selectColumn: ColumnDef<TData, unknown> = {
      id: "__select__",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllRowsSelected()
              ? true
              : table.getIsSomeRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(value) => table.toggleAllRowsSelected(value === true)}
          aria-label={selection.selectAllLabel}
        />
      ),
      cell: ({ row }) =>
        row.getIsGrouped() ? null : (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(value === true)}
            aria-label={selection.selectRowLabel}
          />
        ),
      enableSorting: false,
    };
    return [selectColumn, ...columns];
  }, [columns, selection]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: tableColumns,
    getRowId,
    state: {
      sorting,
      expanded,
      grouping: groupBy ? [groupBy] : [],
      // The grouped column's value is already shown in the group header
      // (renderGroupHeader) — rendering it again as its own header+cells
      // would just repeat the same value on every row in the group.
      // Hiding it (rather than the old approach of leaving each cell
      // blank) means it doesn't occupy a header slot or column width at
      // all. Visibility and grouping are independent in TanStack Table —
      // `table.getColumn`/grouping still resolves a hidden column fine.
      columnVisibility: groupBy ? { [groupBy]: false } : {},
      rowSelection,
    },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onRowSelectionChange: handleRowSelectionChange,
    // Grouped "rows" are synthetic header rows, not real data — never
    // selectable, and excluded from table.toggleAllRowsSelected() too.
    enableRowSelection: (row) => !row.getIsGrouped(),
    // `getGroupedRowModel` recomputes on every `data` change (i.e. every
    // react-query refetch — after create/edit/delete/duplicate, or just
    // refocusing the tab), and each recompute queues TWO auto-resets:
    // `_autoResetExpanded` and `_autoResetPageIndex`. We never set
    // `initialState.expanded`, so the expanded reset drops `expanded` to
    // `{}` (all collapsed) instead of back to the `true` we start with —
    // any date group the user had open snaps shut right after the list
    // refetches. Disable both: this table manages `expanded` itself and
    // has no pagination to reset in the first place. Root cause lives in
    // `getGroupedRowModel` (TanStack Table); the page-index half is also
    // a known, long-standing issue: TanStack/table#5026.
    autoResetExpanded: false,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const showBulkBar = selection && selection.selectedIds.size > 0;

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          {showBulkBar ? (
            <TableRow>
              <TableHead colSpan={table.getVisibleFlatColumns().length} className="p-2">
                {selection.renderBulkActions(selection.selectedIds)}
              </TableHead>
            </TableRow>
          ) : (
            table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                      className={cn(canSort && "cursor-pointer select-none")}
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center gap-1">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {sortDirection === "asc" && (
                            <CaretUpIcon className="text-muted-foreground" />
                          )}
                          {sortDirection === "desc" && (
                            <CaretDownIcon className="text-muted-foreground" />
                          )}
                        </span>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => {
              if (row.getIsGrouped()) {
                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer bg-muted/50 font-medium hover:bg-muted"
                    onClick={row.getToggleExpandedHandler()}
                    aria-expanded={row.getIsExpanded()}
                  >
                    <TableCell colSpan={table.getVisibleFlatColumns().length}>
                      <span className="inline-flex items-center gap-1.5">
                        {row.getIsExpanded() ? (
                          <CaretDownIcon />
                        ) : (
                          <CaretRightIcon />
                        )}
                        {renderGroupHeader?.(row)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              }

              return (
                <TableRow
                  key={row.id}
                  className="group"
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={table.getVisibleFlatColumns().length}
                className="h-32 text-center"
              >
                {emptyState}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
