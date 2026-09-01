"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { formatPersonName } from "@/lib/format-person-name";
import {
  ArrowsClockwiseIcon,
  CalendarCheckIcon,
  CaretDownIcon,
  CaretUpIcon,
  CreditCardIcon,
  DotsThreeIcon,
  PencilSimpleIcon,
  ShuffleIcon,
  UserIcon,
} from "@phosphor-icons/react";
import type { ColumnDef } from "@tanstack/react-table";
import type { RecurrenceRow } from "../../_types/types";

type ColumnMessages = {
  columns: {
    description: string;
    account: string;
    category: string;
    frequency: string;
    duration: string;
    amount: string;
    person: string;
  };
  noCategory: string;
  frequencyLabel: (frequency: RecurrenceRow["frequency"]) => string;
  finishedLabel: string;
  // "Dividido (N pessoas)" (table.splitPill) — the collapsed pill shown
  // in the Person column for a multi-split recurrence; clicking it
  // toggles the per-person breakdown rows below (see renderSubRows in
  // recurrences-view.tsx). Mirrors transactions' own splitPillLabel.
  splitPillLabel: (count: number) => string;
  // "Gerar mais 12 meses" / "Gerando…" — shown under the description for
  // rows listRecurrences flagged needsExtension (tasks/012's low-runway
  // prompt), see actions.extend/isExtending below.
  extendLabel: string;
  extendingLabel: string;
  // "Adiantar" / "Adiantando…" — shown under the description for rows
  // listRecurrences flagged canAdvance (a still-PENDING occurrence
  // exists), see actions.onAdvance/isAdvancing below.
  advanceLabel: string;
  advancingLabel: string;
  // aria-label for the small credit-card icon next to the account name
  // (accountColumn below) — same convention as transactions' own
  // creditCardAccountLabel in table/columns.tsx.
  creditCardAccountLabel: string;
  menuAria: string;
  menuEdit: string;
  menuDelete: string;
};

type ColumnActions = {
  onEdit: (row: RecurrenceRow) => void;
  onDelete: (row: RecurrenceRow) => void;
  // Triggers extendRecurrenceGeneration for this row — owned by
  // recurrences-view.tsx (same split as onEdit/onDelete), which also
  // tracks which row(s) are currently pending via isExtending below.
  onExtend: (row: RecurrenceRow) => void;
  isExtending: (id: string) => boolean;
  // Triggers advanceRecurrenceOccurrence for this row — same split as
  // onExtend/isExtending above.
  onAdvance: (row: RecurrenceRow) => void;
  isAdvancing: (id: string) => boolean;
};

export function getRecurrenceColumns(
  messages: ColumnMessages,
  formatAmount: (amount: number) => string,
  formatDuration: (start: Date, end: Date | null) => string,
  actions: ColumnActions,
): ColumnDef<RecurrenceRow, unknown>[] {
  return [
    {
      accessorKey: "description",
      header: messages.columns.description,
      cell: ({ row }) => {
        const CategoryIcon = resolveCategoryIcon(row.original.category?.icon);
        const pending = actions.isExtending(row.original.id);
        const advancing = actions.isAdvancing(row.original.id);
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="size-6.5">
                <AvatarFallback
                  className={row.original.category?.colorStyle || "bg-muted text-muted-foreground"}
                >
                  <CategoryIcon className="size-3.5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate text-sm font-medium">
                  {row.original.description}
                </span>
                {!row.original.isActive && (
                  <Badge variant="secondary" className="shrink-0">
                    {messages.finishedLabel}
                  </Badge>
                )}
              </div>
            </div>
            {row.original.needsExtension && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.onExtend(row.original);
                }}
                disabled={pending}
                className="flex w-fit shrink-0 items-center gap-1 pl-9 text-xs text-primary transition-colors hover:underline disabled:pointer-events-none disabled:opacity-60"
              >
                <ArrowsClockwiseIcon className="size-3" />
                {pending ? messages.extendingLabel : messages.extendLabel}
              </button>
            )}
            {row.original.canAdvance && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.onAdvance(row.original);
                }}
                disabled={advancing}
                className="flex w-fit shrink-0 items-center gap-1 pl-9 text-xs text-primary transition-colors hover:underline disabled:pointer-events-none disabled:opacity-60"
              >
                <CalendarCheckIcon className="size-3" />
                {advancing ? messages.advancingLabel : messages.advanceLabel}
              </button>
            )}
          </div>
        );
      },
    },
    {
      id: "person",
      accessorFn: (row) =>
        row.splits.map((split) => formatPersonName(split.person.name)).join(", "),
      header: () => <div className="w-40">{messages.columns.person}</div>,
      cell: ({ row, getValue }) => {
        const splits = row.original.splits;
        if (splits.length <= 1) {
          return (
            <div className="w-40 shrink-0">
              <Badge variant="secondary" className="max-w-full gap-1 font-normal">
                <UserIcon className="size-3 shrink-0" />
                <span className="min-w-0 truncate">{getValue() as string}</span>
              </Badge>
            </div>
          );
        }
        // More than one person — the "Valor" column already shows the
        // recurrence's total, so this collapses to a "Dividido (N
        // pessoas)" pill that expands (via row.toggleExpanded(), rendered
        // by DataTable's renderSubRows) into one indented row per person
        // below, each showing their own split amount.
        return (
          <div className="w-40 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                row.toggleExpanded();
              }}
              aria-expanded={row.getIsExpanded()}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning transition-colors hover:bg-warning/25"
            >
              <ShuffleIcon className="size-3 shrink-0" />
              <span className="min-w-0 truncate">
                {messages.splitPillLabel(splits.length)}
              </span>
              {row.getIsExpanded() ? (
                <CaretUpIcon className="size-3 shrink-0" />
              ) : (
                <CaretDownIcon className="size-3 shrink-0" />
              )}
            </button>
          </div>
        );
      },
    },
    {
      id: "account",
      accessorFn: (row) => row.account.name,
      header: () => <div className="w-28">{messages.columns.account}</div>,
      cell: ({ row }) => (
        <div className="flex w-28 shrink-0 items-center gap-1">
          {row.original.account.type === "CREDIT_CARD" && (
            <CreditCardIcon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-label={messages.creditCardAccountLabel}
            />
          )}
          <span className="truncate text-sm">{row.original.account.name}</span>
        </div>
      ),
    },
    {
      id: "category",
      accessorFn: (row) => row.category?.name ?? messages.noCategory,
      header: () => <div className="w-28">{messages.columns.category}</div>,
      cell: ({ getValue }) => (
        <div className="w-28 shrink-0 truncate text-sm">{getValue() as string}</div>
      ),
    },
    {
      id: "frequency",
      accessorFn: (row) => messages.frequencyLabel(row.frequency),
      header: () => <div className="w-20">{messages.columns.frequency}</div>,
      cell: ({ getValue }) => (
        <div className="w-20 shrink-0 truncate text-sm">{getValue() as string}</div>
      ),
    },
    {
      id: "duration",
      accessorFn: (row) => formatDuration(row.startDate, row.endDate),
      header: () => <div className="w-40">{messages.columns.duration}</div>,
      cell: ({ getValue }) => (
        <div className="w-40 shrink-0 truncate text-sm text-muted-foreground">
          {getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: () => <div className="w-24 text-right">{messages.columns.amount}</div>,
      cell: ({ row }) => (
        <div className="w-24 shrink-0 text-right">
          <span
            className={cn(
              "font-medium tabular-nums",
              row.original.amount < 0 ? "text-negative" : "text-positive",
            )}
          >
            {formatAmount(row.original.amount)}
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex shrink-0 items-center justify-end gap-0.5">
          {/* Same hover-reveal pattern as the transactions table's own
              actions column (columns.tsx there) — Edit is the common
              case, so it gets its own always-reachable button instead of
              costing an extra click through the dropdown every time.
              opacity-0/group-hover pairs with the `group` class DataTable
              puts on each row; focus-visible covers keyboard users. Still
              duplicated inside the dropdown for touch devices. */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
            onClick={() => actions.onEdit(row.original)}
          >
            <PencilSimpleIcon />
            <span className="sr-only">{messages.menuEdit}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <DotsThreeIcon />
                <span className="sr-only">{messages.menuAria}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => actions.onEdit(row.original)}>
                {messages.menuEdit}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => actions.onDelete(row.original)}
              >
                {messages.menuDelete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
}
