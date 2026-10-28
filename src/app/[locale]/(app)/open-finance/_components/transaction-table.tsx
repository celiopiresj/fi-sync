"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { BankIcon } from "@phosphor-icons/react";
import { parseCalendarDate } from "@/lib/date";
import { isNegativeAmount } from "@/lib/open-finance/normalize";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { useOpenFinanceTransactions } from "../_hooks/use-open-finance";
import { usePreviewTable } from "../_hooks/use-preview-table";
import { ReviewSheet } from "./review-sheet";
import type { PreviewRow, TransactionTableProps } from "../_types/types";

export function TransactionTable({ source }: TransactionTableProps) {
  const t = useTranslations("scrn-open-finance");
  const common = useTranslations("common");
  const formatter = useFormatter();
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [selected, setSelected] = useState<PreviewRow | null>(null);
  const query = useOpenFinanceTransactions(source.id, cursors[cursors.length - 1]);
  const table = usePreviewTable(query.data?.data?.rows);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{t("table.selection.count", { count: table.getRowModel().rows.length })}</span>
        <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>{t("buttons.refresh")}</Button>
      </div>
      {query.isPending && <p role="status">{common("status.loading")}</p>}
      {(query.isError || query.data?.error) && <p role="alert" className="text-negative">{query.data?.error ?? t("errors.provider.description")}</p>}
      {query.data?.data && table.getRowModel().rows.length === 0 && <Empty>
        <EmptyHeader><EmptyMedia variant="icon"><BankIcon /></EmptyMedia><EmptyTitle>{t("table.empty.title")}</EmptyTitle><EmptyDescription>{t("table.empty.description")}</EmptyDescription></EmptyHeader>
      </Empty>}
      <div className="flex flex-col divide-y rounded-lg border empty:hidden">
        {table.getRowModel().rows.map(({ original: row }) => (
          <div key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="wrap-break-word text-sm font-medium">{row.description}</span>
              <span className="text-xs text-muted-foreground">{formatter.dateTime(parseCalendarDate(row.date), { dateStyle: "short" })}</span>
              {row.status === "PENDING" && <span className="text-xs text-warning">{t("table.menu.pending")}</span>}
              {row.payment && <span className="text-xs text-warning">{t("table.menu.payment")}</span>}
              {row.amount === null && <span className="text-xs text-warning">{t("errors.currency.description")}</span>}
            </div>
            <div className="flex items-center justify-between gap-4 sm:justify-end">
              {row.amount !== null && <span className={isNegativeAmount(row.amount) ? "text-sm font-medium text-negative" : "text-sm font-medium text-positive"}>{formatter.number(Number(row.amount), { style: "currency", currency: "BRL" })}</span>}
              <Button variant="outline" size="sm" disabled={row.amount === null} onClick={() => setSelected(row)}>{t("buttons.review")}</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-3">
        <Button variant="outline" disabled={query.isFetching || cursors.length <= 1} onClick={() => setCursors((previous) => previous.slice(0, -1))}>{t("buttons.previous")}</Button>
        <Button variant="outline" disabled={query.isFetching || !query.data?.data?.next} onClick={() => { const next = query.data?.data?.next; if (next) setCursors((previous) => [...previous, next]); }}>{t("buttons.next")}</Button>
      </div>
      <ReviewSheet source={source} row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
