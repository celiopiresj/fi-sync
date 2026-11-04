"use client";

import { useTranslations } from "next-intl";
import { BankIcon, CaretLeftIcon, CaretRightIcon, ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SearchInput } from "@/components/screen/search-input";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { usePreviewReview } from "../_hooks/use-preview-review";
import { PREVIEW_DIRECTIONS } from "../_constants/constants";
import { MonthTabs } from "./month-tabs";
import { MonthSummary } from "./month-summary";
import { PreviewRows } from "./preview-rows";
import { SelectionBar } from "./selection-bar";
import { ExistingDialog } from "./existing-dialog";
import { ReviewSheet } from "./review-sheet";
import type { TransactionTableProps } from "../_types/types";

export function TransactionTable({ source, header, accounts, categories, people, defaultPersonId }: TransactionTableProps) {
  const t = useTranslations("scrn-open-finance");
  const common = useTranslations("common");
  const preview = usePreviewReview(source);
  const { query, filteredRows } = preview;
  const filtered = Boolean(preview.search) || preview.direction !== "all";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="gap-0 py-0">
        {header}
        <MonthTabs months={preview.months} value={preview.month} onChange={preview.changeMonth} />
      </Card>

      {query.data?.data && <MonthSummary summary={preview.summary} />}

      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-3 p-5 lg:flex-row lg:flex-wrap lg:items-center">
          <ToggleGroup type="single" variant="tabs" size="sm" value={preview.direction} onValueChange={preview.changeDirection} aria-label={t("filters.label")}>
            {PREVIEW_DIRECTIONS.map((direction) => <ToggleGroupItem key={direction} value={direction}>{t(`filters.${direction}`)}</ToggleGroupItem>)}
          </ToggleGroup>
          <SearchInput value={preview.search} onChange={preview.changeSearch} placeholder={t("filters.search")} clearLabel={t("filters.clear")} className="min-w-0 sm:w-auto lg:flex-1" />
          <Button type="button" variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}><ArrowsClockwiseIcon />{t("buttons.refresh")}</Button>
        </div>

        {query.isPending && <p role="status" className="px-5 pb-5">{common("status.loading")}</p>}
        {(query.isError || query.data?.error) && <p role="alert" className="px-5 pb-5 text-sm text-negative">{query.data?.error ?? t("errors.provider.description")}</p>}
        {query.data?.data && filteredRows.length === 0 && <Empty className="pb-10">
          <EmptyHeader>
            <EmptyMedia variant="icon"><BankIcon /></EmptyMedia>
            <EmptyTitle>{filtered ? t("filters.empty") : t("table.empty.title")}</EmptyTitle>
            {!filtered && <EmptyDescription>{t("table.empty.description")}</EmptyDescription>}
          </EmptyHeader>
        </Empty>}
        {filteredRows.length > 0 && <PreviewRows preview={preview} />}

        {(preview.hasPrevious || preview.hasNext) && <div className="flex items-center justify-end gap-3 border-t px-5 py-3">
          <span className="text-xs text-muted-foreground">{t("pagination.page", { page: preview.page })}</span>
          <Button type="button" variant="outline" size="icon-sm" aria-label={t("buttons.previous")} disabled={query.isFetching || !preview.hasPrevious} onClick={preview.previousPage}><CaretLeftIcon /></Button>
          <Button type="button" variant="outline" size="icon-sm" aria-label={t("buttons.next")} disabled={query.isFetching || !preview.hasNext} onClick={preview.nextPage}><CaretRightIcon /></Button>
        </div>}
      </Card>

      <SelectionBar preview={preview} />
      <ExistingDialog preview={preview} />

      <ReviewSheet source={source} row={preview.row} remaining={preview.remaining} accounts={accounts} categories={categories} people={people} defaultPersonId={defaultPersonId} onClose={preview.close} onProcessed={preview.processed} />
    </div>
  );
}
