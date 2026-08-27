import { Fragment } from "react";
import type { Column } from "@tanstack/react-table";
import { ArrowBendDownRightIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { TableCell, TableRow } from "@/components/ui/table";

// Shared with DataTable's `renderSubRows` (transactions and recurrences
// tables both use it): renders one indented row per person once a
// multi-split row is expanded via its "Dividido (N pessoas)" pill (see
// each table's own person column cell for the toggle). Kept generic on
// purpose — the two tables' split shapes differ slightly (Transaction
// splits carry an `id`, RecurrenceSplit doesn't), so the caller maps its
// own splits into this common shape first.
export type SplitSubRowEntry = {
  key: string;
  personName: string;
  amount: number;
};

// Finds where the "amount" column sits among the table's own visible
// columns (DataTable passes these straight through from
// `table.getVisibleLeafColumns()`) and returns how many columns come
// before/after it — lets the sub-row's own amount land in a real cell
// directly under the "Valor" header instead of floating at the end of
// one merged colSpan cell, which used to leave it misaligned whenever
// other columns (Pessoa, Ações, …) followed Valor.
function columnSpanAround<TData>(columns: Column<TData, unknown>[]) {
  const amountIndex = columns.findIndex((column) => column.id === "amount");
  if (amountIndex === -1) {
    // No "amount" column found (shouldn't happen for transactions/
    // recurrences) — fall back to one merged cell across everything.
    return { before: columns.length, after: 0 };
  }
  return { before: amountIndex, after: columns.length - amountIndex - 1 };
}

export function renderSplitSubRows<TData>(
  splits: SplitSubRowEntry[],
  columns: Column<TData, unknown>[],
  formatAmount: (amount: number) => string,
) {
  if (splits.length <= 1) return null;
  const { before, after } = columnSpanAround(columns);
  return (
    <Fragment>
      {splits.map((split) => (
        <TableRow key={split.key} className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={before} className="py-1.5">
            <div className="flex items-center gap-2 pl-9 text-xs">
              <ArrowBendDownRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
                {split.personName.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 truncate text-muted-foreground">
                {split.personName}
              </span>
            </div>
          </TableCell>
          <TableCell className="w-24 py-1.5 text-right">
            <span
              className={cn(
                "font-medium tabular-nums",
                split.amount < 0 ? "text-negative" : "text-positive",
              )}
            >
              {formatAmount(split.amount)}
            </span>
          </TableCell>
          {after > 0 && <TableCell colSpan={after} className="py-1.5" />}
        </TableRow>
      ))}
    </Fragment>
  );
}
