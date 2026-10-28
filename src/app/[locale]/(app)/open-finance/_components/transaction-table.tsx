"use client";

import { useFormatter, useTranslations } from "next-intl";
import { ArrowRightIcon, BankIcon, CaretLeftIcon, CaretRightIcon, ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { parseCalendarDate } from "@/lib/date";
import { isNegativeAmount } from "@/lib/open-finance/normalize";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SearchInput } from "@/components/screen/search-input";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { usePreviewReview } from "../_hooks/use-preview-review";
import { PREVIEW_DIRECTIONS } from "../_constants/constants";
import { ReviewSheet } from "./review-sheet";
import type { TransactionTableProps } from "../_types/types";

export function TransactionTable({ source }: TransactionTableProps) {
  const t = useTranslations("scrn-open-finance");
  const common = useTranslations("common");
  const formatter = useFormatter();
  const preview = usePreviewReview(source);
  const { query, table } = preview;
  return <div className="flex min-w-0 flex-col">
    <div className="flex flex-col gap-4 px-5 pb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-base font-semibold">{t("cards.review.title")}</h2><span className="text-xs text-muted-foreground">{t("table.selection.count", { count: table.getPreFilteredRowModel().rows.length })}</span></div>
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <ToggleGroup type="single" variant="tabs" size="sm" value={preview.direction} onValueChange={preview.changeDirection} aria-label={t("filters.label")}>
          {PREVIEW_DIRECTIONS.map((direction) => <ToggleGroupItem key={direction} value={direction}>{t(`filters.${direction}`)}</ToggleGroupItem>)}
        </ToggleGroup>
        <SearchInput value={preview.search} onChange={preview.changeSearch} placeholder={t("filters.search")} clearLabel={t("filters.clear")} className="min-w-0 sm:w-auto lg:flex-1" />
        <Button type="button" variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}><ArrowsClockwiseIcon />{t("buttons.refresh")}</Button>
      </div>
    </div>
    {query.isPending && <p role="status" className="px-5 pb-4">{common("status.loading")}</p>}
    {(query.isError || query.data?.error) && <p role="alert" className="px-5 pb-4 text-sm text-negative">{query.data?.error ?? t("errors.provider.description")}</p>}
    {query.data?.data && table.getRowModel().rows.length === 0 && <Empty><EmptyHeader><EmptyMedia variant="icon"><BankIcon /></EmptyMedia><EmptyTitle>{preview.search || preview.direction !== "all" ? t("filters.empty") : t("table.empty.title")}</EmptyTitle>{!preview.search && preview.direction === "all" && <EmptyDescription>{t("table.empty.description")}</EmptyDescription>}</EmptyHeader></Empty>}
    {table.getRowModel().rows.length > 0 && <>
      <div className="hidden md:block">
        <Table className="min-w-160 text-sm">
          <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-10 pl-5"><Checkbox aria-label={t("table.selection.all")} checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() ? "indeterminate" : false)} disabled={table.getRowModel().rows.every((row) => !row.getCanSelect())} onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)} /></TableHead>
            <TableHead className="text-xs">{t("table.columns.date")}</TableHead><TableHead className="text-xs">{t("table.columns.description")}</TableHead><TableHead className="text-xs">{t("fields.type.label")}</TableHead><TableHead className="text-right text-xs">{t("table.columns.amount")}</TableHead><TableHead className="pr-5 text-right text-xs">{t("table.columns.actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>{table.getRowModel().rows.map((tableRow) => <TableRow key={tableRow.id} data-state={tableRow.getIsSelected() ? "selected" : undefined} className="data-[state=selected]:bg-primary/5">
            <TableCell className="pl-5"><Checkbox aria-label={t("table.selection.row", { description: tableRow.original.description })} checked={tableRow.getIsSelected()} disabled={!tableRow.getCanSelect()} onCheckedChange={(checked) => tableRow.toggleSelected(checked === true)} /></TableCell>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">{formatter.dateTime(parseCalendarDate(tableRow.original.date), { dateStyle: "short" })}</TableCell>
            <TableCell className="max-w-80 py-3"><span className="block truncate font-medium" title={tableRow.original.description}>{tableRow.original.description}</span>{tableRow.original.status === "PENDING" && <span className="block text-xs text-warning">{t("table.menu.pending")}</span>}{tableRow.original.payment && <span className="block text-xs text-warning">{t("table.menu.payment")}</span>}{tableRow.original.amount === null && <span className="block text-xs text-warning">{t("errors.currency.description")}</span>}</TableCell>
            <TableCell><span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs whitespace-nowrap">{tableRow.original.amount === null ? t("errors.currency.title") : t(isNegativeAmount(tableRow.original.amount) ? "filters.expense" : "filters.income")}</span></TableCell>
            <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums">{tableRow.original.amount !== null && <span className={isNegativeAmount(tableRow.original.amount) ? "text-negative" : "text-positive"}>{formatter.number(Number(tableRow.original.amount), { style: "currency", currency: "BRL" })}</span>}</TableCell>
            <TableCell className="pr-5 text-right"><Button type="button" variant="outline" size="sm" disabled={tableRow.original.amount === null} onClick={() => preview.reviewRow(tableRow.original)}>{t("buttons.review")}</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
      <div className="flex flex-col divide-y border-t md:hidden">
        <label className="flex items-center gap-3 px-5 py-3 text-sm"><Checkbox checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() ? "indeterminate" : false)} disabled={table.getRowModel().rows.every((row) => !row.getCanSelect())} onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)} />{t("table.selection.all")}</label>
        {table.getRowModel().rows.map((tableRow) => <div key={tableRow.id} className="flex items-start gap-3 px-5 py-4">
          <Checkbox className="mt-1" aria-label={t("table.selection.row", { description: tableRow.original.description })} checked={tableRow.getIsSelected()} disabled={!tableRow.getCanSelect()} onCheckedChange={(checked) => tableRow.toggleSelected(checked === true)} />
          <div className="flex min-w-0 flex-1 flex-col gap-2"><span className="text-sm font-medium wrap-break-word">{tableRow.original.description}</span><span className="text-xs text-muted-foreground">{formatter.dateTime(parseCalendarDate(tableRow.original.date), { dateStyle: "short" })}</span>
            {tableRow.original.status === "PENDING" && <span className="text-xs text-warning">{t("table.menu.pending")}</span>}{tableRow.original.payment && <span className="text-xs text-warning">{t("table.menu.payment")}</span>}{tableRow.original.amount === null && <span className="text-xs text-warning">{t("errors.currency.description")}</span>}
            <div className="flex flex-wrap items-center justify-between gap-3">{tableRow.original.amount !== null && <span className={isNegativeAmount(tableRow.original.amount) ? "text-sm font-semibold text-negative" : "text-sm font-semibold text-positive"}>{formatter.number(Number(tableRow.original.amount), { style: "currency", currency: "BRL" })}</span>}<Button type="button" variant="outline" size="sm" disabled={tableRow.original.amount === null} onClick={() => preview.reviewRow(tableRow.original)}>{t("buttons.review")}</Button></div>
          </div>
        </div>)}
      </div>
    </>}
    <div className="mt-4 flex flex-col gap-4 border-t bg-muted/30 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{t("pagination.page", { page: preview.page })}</span><Button type="button" variant="outline" size="icon-sm" aria-label={t("buttons.previous")} disabled={query.isFetching || !preview.hasPrevious} onClick={preview.previousPage}><CaretLeftIcon /></Button><Button type="button" variant="outline" size="icon-sm" aria-label={t("buttons.next")} disabled={query.isFetching || !query.data?.data?.next} onClick={preview.nextPage}><CaretRightIcon /></Button></div><span className="text-xs text-muted-foreground">{t("table.selection.selected", { count: preview.selectedCount })}</span></div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"><span className="mr-auto flex flex-wrap gap-2 text-sm"><span className="text-muted-foreground">{t("table.selection.total")}</span><span className="font-semibold tabular-nums">{formatter.number(Number(preview.selectedTotal), { style: "currency", currency: "BRL" })}</span></span><Button type="button" variant="outline" disabled={preview.selectedCount === 0} onClick={() => table.resetRowSelection()}>{t("table.selection.clear")}</Button><Button type="button" disabled={preview.selectedCount === 0} onClick={preview.reviewSelected}>{t("table.selection.review", { count: preview.selectedCount })}<ArrowRightIcon /></Button></div>
    </div>
    <ReviewSheet source={source} row={preview.row} remaining={preview.remaining} onClose={preview.close} onProcessed={preview.processed} />
  </div>;
}
