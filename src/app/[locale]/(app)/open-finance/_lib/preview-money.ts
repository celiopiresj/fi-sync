import { add, BRL, dinero, toDecimal } from "dinero.js";
import { isNegativeAmount } from "@/lib/open-finance/normalize";
import type { PreviewDay, PreviewDirection, PreviewRow } from "../_types/types";

export function matchesDirection(row: PreviewRow, direction: PreviewDirection) {
  if (direction === "all") return true;
  if (row.amount === null) return false;
  return direction === "expense" ? isNegativeAmount(row.amount) : !isNegativeAmount(row.amount);
}

const zero = () => dinero({ amount: 0, currency: BRL });

// Preview amounts always arrive as two-decimal strings ("-19.99").
function amountOf(row: PreviewRow) {
  return row.amount === null ? null : dinero({ amount: Number(row.amount.replace(".", "")), currency: BRL });
}

function sum(rows: PreviewRow[]) {
  return rows.reduce((total, row) => {
    const amount = amountOf(row);
    return amount ? add(total, amount) : total;
  }, zero());
}

export function selectedPreviewTotal(rows: PreviewRow[]) {
  return toDecimal(sum(rows));
}

export function previewSummary(rows: PreviewRow[]) {
  const priced = rows.filter((row) => row.amount !== null);
  return {
    income: toDecimal(sum(priced.filter((row) => !isNegativeAmount(row.amount!)))),
    expense: toDecimal(sum(priced.filter((row) => isNegativeAmount(row.amount!)))),
    count: rows.length,
  };
}

// Rows keep the provider order inside each day; days are newest first.
export function groupRowsByDay(rows: PreviewRow[]): PreviewDay[] {
  const days = new Map<string, PreviewRow[]>();
  for (const row of rows) days.set(row.date, [...(days.get(row.date) ?? []), row]);
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, entries]) => ({ date, rows: entries, total: selectedPreviewTotal(entries) }));
}
