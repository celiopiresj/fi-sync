"use client";

import { useFormatter, useTranslations } from "next-intl";
import { BankIcon } from "@phosphor-icons/react";
import { parseCalendarDate } from "@/lib/date";
import { isNegativeAmount } from "@/lib/open-finance/normalize";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { usePreviewReview } from "../_hooks/use-preview-review";
import { ReviewSheet } from "./review-sheet";
import type { TransactionTableProps } from "../_types/types";

export function TransactionTable({ source }: TransactionTableProps) {
  const t = useTranslations("scrn-open-finance");
  const common = useTranslations("common");
  const formatter = useFormatter();
  const preview = usePreviewReview(source);
  const { query, table } = preview;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{t("table.selection.count", { count: table.getRowModel().rows.length })}</span>
        <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>{t("buttons.refresh")}</Button>
      </div>
      {query.isPending && <p role="status">{common("status.loading")}</p>}
      {(query.isError || query.data?.error) && <p role="alert" className="text-negative">{query.data?.error ?? t("errors.provider.description")}</p>}
      {table.getRowModel().rows.length > 0 && <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() ? "indeterminate" : false)} disabled={table.getRowModel().rows.every((row) => !row.getCanSelect())} onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)} />{t("table.selection.all")}</label>
          <span className="text-xs text-muted-foreground">{t("table.selection.selected", { count: preview.selectedCount })}</span>
        </div>
        <Button type="button" disabled={preview.selectedCount === 0} onClick={preview.reviewSelected}>{t("buttons.reviewSelected")}</Button>
      </div>}
      {query.data?.data && table.getRowModel().rows.length === 0 && <Empty>
        <EmptyHeader><EmptyMedia variant="icon"><BankIcon /></EmptyMedia><EmptyTitle>{t("table.empty.title")}</EmptyTitle><EmptyDescription>{t("table.empty.description")}</EmptyDescription></EmptyHeader>
      </Empty>}
      <div className="flex flex-col divide-y rounded-lg border empty:hidden">
        {table.getRowModel().rows.map((tableRow) => (
          <div key={tableRow.id} className="flex items-start gap-3 p-4">
            <Checkbox className="mt-1" aria-label={t("table.selection.row", { description: tableRow.original.description })} checked={tableRow.getIsSelected()} disabled={!tableRow.getCanSelect()} onCheckedChange={(checked) => tableRow.toggleSelected(checked === true)} />
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="wrap-break-word text-sm font-medium">{tableRow.original.description}</span>
                <span className="text-xs text-muted-foreground">{formatter.dateTime(parseCalendarDate(tableRow.original.date), { dateStyle: "short" })}</span>
                {tableRow.original.status === "PENDING" && <span className="text-xs text-warning">{t("table.menu.pending")}</span>}
                {tableRow.original.payment && <span className="text-xs text-warning">{t("table.menu.payment")}</span>}
                {tableRow.original.amount === null && <span className="text-xs text-warning">{t("errors.currency.description")}</span>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                {tableRow.original.amount !== null && <span className={isNegativeAmount(tableRow.original.amount) ? "text-sm font-medium text-negative" : "text-sm font-medium text-positive"}>{formatter.number(Number(tableRow.original.amount), { style: "currency", currency: "BRL" })}</span>}
                <Button variant="outline" size="sm" disabled={tableRow.original.amount === null} onClick={() => preview.reviewRow(tableRow.original)}>{t("buttons.review")}</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-3">
        <Button variant="outline" disabled={query.isFetching || !preview.hasPrevious} onClick={preview.previousPage}>{t("buttons.previous")}</Button>
        <Button variant="outline" disabled={query.isFetching || !query.data?.data?.next} onClick={preview.nextPage}>{t("buttons.next")}</Button>
      </div>
      <ReviewSheet source={source} row={preview.row} remaining={preview.remaining} onClose={preview.close} onProcessed={preview.processed} />
    </div>
  );
}
