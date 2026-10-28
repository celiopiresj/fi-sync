import { add, BRL, dinero, toDecimal } from "dinero.js";
import { isNegativeAmount } from "@/lib/open-finance/normalize";
import type { PreviewDirection, PreviewRow } from "../_types/types";

export function matchesDirection(row: PreviewRow, direction: PreviewDirection) {
  if (direction === "all") return true;
  if (row.amount === null) return false;
  return direction === "expense" ? isNegativeAmount(row.amount) : !isNegativeAmount(row.amount);
}

export function selectedPreviewTotal(rows: PreviewRow[]) {
  return toDecimal(rows.reduce((total, row) => row.amount === null ? total :
    add(total, dinero({ amount: Number(row.amount.replace(".", "")), currency: BRL })), dinero({ amount: 0, currency: BRL })));
}
