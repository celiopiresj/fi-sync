"use client";

import { useTranslations } from "next-intl";
import { CaretDownIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { transactionFormStatusValues } from "../../_schema/schema";
import type { BulkStatus } from "../../actions";
import type { CategoryOption } from "../../_types/types";

// Replaces DataTable's header row while any rows are selected (see the
// `selection` doc comment on DataTable) — correcting an imported month
// used to cost one click per transaction; this is what makes it one
// click for the whole batch. Presentational only, same split as
// DeleteDialog/TransactionSheet: the actual Server Action calls,
// invalidate(), and toasts live in transactions-view.tsx.
type BulkActionsBarProps = {
  selectedCount: number;
  categories: CategoryOption[];
  isPending: boolean;
  onCategorize: (categoryId: string | null) => void;
  onChangeStatus: (status: BulkStatus) => void;
  onDeleteRequest: () => void;
  onClear: () => void;
};

export function BulkActionsBar({
  selectedCount,
  categories,
  isPending,
  onCategorize,
  onChangeStatus,
  onDeleteRequest,
  onClear,
}: BulkActionsBarProps) {
  const t = useTranslations("scrn-transactions");
  const tCommon = useTranslations("common");

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClear}
          aria-label={t("table.bulk.clear")}
        >
          <XIcon />
        </Button>
        <span className="text-sm font-medium">
          {t("table.selection", { count: selectedCount })}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              className="gap-1.5"
            >
              {t("table.bulk.categorize")}
              <CaretDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onCategorize(null)}>
              {t("chart.byCategory.uncategorized")}
            </DropdownMenuItem>
            {categories.map((category) => (
              <DropdownMenuItem
                key={category.id}
                onSelect={() => onCategorize(category.id)}
              >
                {category.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              className="gap-1.5"
            >
              {t("table.bulk.changeStatus")}
              <CaretDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {transactionFormStatusValues.map((status) => (
              <DropdownMenuItem key={status} onSelect={() => onChangeStatus(status)}>
                {tCommon(`status.${status.toLowerCase()}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={onDeleteRequest}
          className="text-destructive hover:text-destructive"
        >
          {t("menu.delete")}
        </Button>
      </div>
    </div>
  );
}
