"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { PayoffItem } from "../../_types/types";
import {
  InstallmentsCell,
  MoneyCell,
  MonthCell,
  PurchaseCell,
} from "./payoff-cells";

type ColumnMessages = {
  purchase: string;
  people: string;
  installments: string;
  installmentAmount: string;
  lastMonth: string;
  remaining: string;
};

// `showPeople` is off while the screen is filtered to one person — the
// column would just repeat their name on every row.
export function getPayoffColumns(
  messages: ColumnMessages,
  options: { showPeople: boolean },
): ColumnDef<PayoffItem, unknown>[] {
  const peopleColumn: ColumnDef<PayoffItem, unknown> = {
    id: "people",
    accessorFn: (row) => row.people.join(", "),
    header: messages.people,
    cell: ({ getValue }) => (
      <span className="block max-w-48 truncate text-sm text-muted-foreground">
        {getValue() as string}
      </span>
    ),
  };

  return [
    {
      id: "purchase",
      accessorFn: (row) => row.description,
      header: messages.purchase,
      cell: ({ row }) => <PurchaseCell item={row.original} />,
    },
    ...(options.showPeople ? [peopleColumn] : []),
    {
      id: "installments",
      accessorFn: (row) => row.remainingCount,
      header: () => <div className="w-36">{messages.installments}</div>,
      cell: ({ row }) => (
        <div className="w-36 shrink-0">
          <InstallmentsCell item={row.original} />
        </div>
      ),
    },
    {
      id: "installmentAmount",
      accessorFn: (row) => row.installmentAmount,
      header: () => <div className="w-28 text-right">{messages.installmentAmount}</div>,
      cell: ({ row }) => (
        <div className="w-28 shrink-0 text-right text-sm">
          {row.original.isInstallment ? (
            <MoneyCell value={row.original.installmentAmount} muted />
          ) : null}
        </div>
      ),
    },
    {
      id: "lastMonth",
      accessorFn: (row) => row.lastMonth,
      header: () => <div className="w-20">{messages.lastMonth}</div>,
      cell: ({ row }) => (
        <div className="w-20 shrink-0">
          <MonthCell monthKey={row.original.lastMonth} />
        </div>
      ),
    },
    {
      id: "remaining",
      accessorFn: (row) => row.total,
      header: () => <div className="w-28 text-right">{messages.remaining}</div>,
      cell: ({ row }) => (
        <div className="w-28 shrink-0 text-right text-sm">
          <MoneyCell value={row.original.total} className="font-medium" />
        </div>
      ),
    },
  ];
}
