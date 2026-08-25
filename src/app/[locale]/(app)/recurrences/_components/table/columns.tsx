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
  CreditCardIcon,
  DotsThreeIcon,
  PencilSimpleIcon,
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
  };
  noCategory: string;
  frequencyLabel: (frequency: RecurrenceRow["frequency"]) => string;
  finishedLabel: string;
  // "Gerar mais 12 meses" / "Gerando…" — shown under the description for
  // rows listRecurrences flagged needsExtension (tasks/012's low-runway
  // prompt), see actions.extend/isExtending below.
  extendLabel: string;
  extendingLabel: string;
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
        // Every person the recurrence is split across, not just
        // splits[0] ("quem pagou") — a recurrence divided between
        // several people should show all of them here, same convention
        // as transactions' own Person column (table/columns.tsx there).
        const peopleLabel = row.original.splits
          .map((split) => formatPersonName(split.person.name))
          .join(", ");
        const pending = actions.isExtending(row.original.id);
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="size-6.5">
                <AvatarFallback>
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
            {(peopleLabel || row.original.needsExtension) && (
              <div className="flex min-w-0 items-center gap-2.5 pl-9">
                {peopleLabel && (
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {peopleLabel}
                  </span>
                )}
                {row.original.needsExtension && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.onExtend(row.original);
                    }}
                    disabled={pending}
                    className="flex shrink-0 items-center gap-1 text-xs text-primary transition-colors hover:underline disabled:pointer-events-none disabled:opacity-60"
                  >
                    <ArrowsClockwiseIcon className="size-3" />
                    {pending ? messages.extendingLabel : messages.extendLabel}
                  </button>
                )}
              </div>
            )}
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
