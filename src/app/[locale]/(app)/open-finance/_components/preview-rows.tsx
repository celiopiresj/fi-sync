"use client";

import { Fragment } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CheckIcon } from "@phosphor-icons/react";
import { parseCalendarDate } from "@/lib/date";
import { capitalizeFirst } from "@/lib/capitalize-first";
import { isNegativeAmount } from "@/lib/open-finance/normalize";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { RowFlags } from "./row-flags";
import type { PreviewPanelProps } from "../_types/types";

// Rows of the selected month, grouped by day (newest first) with each
// day's net total. Table at md+, stacked list below it.
export function PreviewRows({ preview }: PreviewPanelProps) {
  const t = useTranslations("scrn-open-finance");
  const formatter = useFormatter();
  const { selectedIds, selectableRows } = preview;
  const allChecked = preview.isAllSelected || (preview.isSomeSelected ? "indeterminate" : false);
  return <>
    <div className="hidden md:block">
      <Table className="min-w-160 text-sm">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-10 pl-5"><Checkbox aria-label={t("table.selection.all")} checked={allChecked} disabled={selectableRows.length === 0} onCheckedChange={(checked) => preview.toggleAll(checked === true)} /></TableHead>
            <TableHead className="text-xs">{t("table.columns.description")}</TableHead>
            <TableHead className="text-xs">{t("fields.type.label")}</TableHead>
            <TableHead className="text-right text-xs">{t("table.columns.amount")}</TableHead>
            <TableHead className="pr-5 text-right text-xs">{t("table.columns.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.days.map((day) => <Fragment key={day.date}>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="px-5 pt-4 pb-1.5 text-xs font-semibold text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>{capitalizeFirst(formatter.dateTime(parseCalendarDate(day.date), { weekday: "short", day: "2-digit", month: "short" }))}</span>
                  <span className={cn("font-medium tabular-nums", isNegativeAmount(day.total) ? "text-negative" : "text-positive")}>{formatter.number(Number(day.total), { style: "currency", currency: "BRL" })}</span>
                </div>
              </TableCell>
            </TableRow>
            {day.rows.map((item) => {
              const isSelected = Boolean(selectedIds[item.id]);
              return <TableRow key={item.id} data-state={isSelected ? "selected" : undefined} className="data-[state=selected]:bg-primary/5">
                <TableCell className="pl-5"><Checkbox aria-label={t("table.selection.row", { description: item.description })} checked={isSelected} disabled={item.amount === null} onCheckedChange={(checked) => preview.toggleRow(item.id, checked === true)} /></TableCell>
                <TableCell className="max-w-120 py-3"><span className="block truncate font-medium" title={item.description}>{item.description}</span><RowFlags row={item} /></TableCell>
                <TableCell><span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs whitespace-nowrap">{item.amount === null ? t("errors.currency.title") : t(isNegativeAmount(item.amount) ? "filters.expense" : "filters.income")}</span></TableCell>
                <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums">{item.amount !== null && <span className={isNegativeAmount(item.amount) ? "text-negative" : "text-positive"}>{formatter.number(Number(item.amount), { style: "currency", currency: "BRL" })}</span>}</TableCell>
                <TableCell className="pr-5 text-right"><div className="flex justify-end gap-2">{item.existing && <Button type="button" variant="ghost" size="sm" className="text-positive" aria-label={t("table.menu.markExistingRow", { description: item.description })} disabled={preview.marking || item.amount === null} onClick={() => preview.markRow(item)}><CheckIcon />{t("table.menu.markExisting")}</Button>}<Button type="button" variant="outline" size="sm" disabled={item.amount === null} onClick={() => preview.reviewRow(item)}>{t("buttons.review")}</Button></div></TableCell>
              </TableRow>;
            })}
          </Fragment>)}
        </TableBody>
      </Table>
    </div>

    <div className="flex flex-col border-t md:hidden">
      <label className="flex items-center gap-3 px-5 py-3 text-sm">
        <Checkbox checked={allChecked} disabled={selectableRows.length === 0} onCheckedChange={(checked) => preview.toggleAll(checked === true)} />
        {t("table.selection.all")}
      </label>
      {preview.days.map((day) => <section key={day.date} className="flex flex-col divide-y border-t">
        <h3 className="flex items-center justify-between gap-3 px-5 pt-3 pb-1.5 text-xs font-semibold text-muted-foreground">
          <span>{capitalizeFirst(formatter.dateTime(parseCalendarDate(day.date), { weekday: "short", day: "2-digit", month: "short" }))}</span>
          <span className={cn("font-medium tabular-nums", isNegativeAmount(day.total) ? "text-negative" : "text-positive")}>{formatter.number(Number(day.total), { style: "currency", currency: "BRL" })}</span>
        </h3>
        {day.rows.map((item) => {
          const isSelected = Boolean(selectedIds[item.id]);
          return <div key={item.id} className={cn("flex items-start gap-3 px-5 py-3", isSelected && "bg-primary/5")}>
            <Checkbox className="mt-1" aria-label={t("table.selection.row", { description: item.description })} checked={isSelected} disabled={item.amount === null} onCheckedChange={(checked) => preview.toggleRow(item.id, checked === true)} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm font-medium wrap-break-word">{item.description}</span>
              <RowFlags row={item} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                {item.amount !== null && <span className={cn("text-sm font-semibold tabular-nums", isNegativeAmount(item.amount) ? "text-negative" : "text-positive")}>{formatter.number(Number(item.amount), { style: "currency", currency: "BRL" })}</span>}
                <div className="flex flex-wrap gap-2">{item.existing && <Button type="button" variant="ghost" size="sm" className="text-positive" aria-label={t("table.menu.markExistingRow", { description: item.description })} disabled={preview.marking || item.amount === null} onClick={() => preview.markRow(item)}><CheckIcon />{t("table.menu.markExisting")}</Button>}<Button type="button" variant="outline" size="sm" disabled={item.amount === null} onClick={() => preview.reviewRow(item)}>{t("buttons.review")}</Button></div>
              </div>
            </div>
          </div>;
        })}
      </section>)}
    </div>
  </>;
}
