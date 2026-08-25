"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CaretRightIcon } from "@phosphor-icons/react";
import type { ColumnDef } from "@tanstack/react-table";
import type { InvoiceRow } from "../../_types/types";

type ColumnMessages = {
  columns: {
    account: string;
    period: string;
    status: string;
    total: string;
  };
  statusLabel: (status: InvoiceRow["displayStatus"]) => string;
  open: string;
};

type ColumnActions = {
  onOpen: (row: InvoiceRow) => void;
};

const statusVariant: Record<
  InvoiceRow["displayStatus"],
  "default" | "secondary" | "outline"
> = {
  OPEN: "outline",
  CLOSED: "secondary",
  PAID: "default",
};

export function getInvoiceColumns(
  messages: ColumnMessages,
  formatAmount: (amount: number) => string,
  formatPeriod: (closingDate: Date, dueDate: Date) => string,
  actions: ColumnActions,
): ColumnDef<InvoiceRow, unknown>[] {
  return [
    {
      id: "account",
      accessorFn: (row) => row.account.name,
      header: messages.columns.account,
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.account.name}</span>
      ),
    },
    {
      id: "period",
      accessorFn: (row) => formatPeriod(row.closingDate, row.dueDate),
      header: () => <div className="w-48">{messages.columns.period}</div>,
      cell: ({ getValue }) => (
        <div className="w-48 shrink-0 truncate text-sm text-muted-foreground">
          {getValue() as string}
        </div>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => row.displayStatus,
      header: () => <div className="w-24">{messages.columns.status}</div>,
      cell: ({ row }) => (
        <div className="w-24 shrink-0">
          <Badge variant={statusVariant[row.original.displayStatus]}>
            {messages.statusLabel(row.original.displayStatus)}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: "total",
      header: () => <div className="w-28 text-right">{messages.columns.total}</div>,
      cell: ({ row }) => (
        <div className="w-28 shrink-0 text-right">
          <span className="font-medium tabular-nums text-negative">
            {formatAmount(row.original.total)}
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex shrink-0 items-center justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => actions.onOpen(row.original)}
          >
            <CaretRightIcon />
            <span className="sr-only">{messages.open}</span>
          </Button>
        </div>
      ),
    },
  ];
}
