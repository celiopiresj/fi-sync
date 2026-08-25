"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DotsThreeIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPersonColorClasses, getPersonInitial } from "../../_lib/person-avatar";
import { joinPersonPhone } from "../../_lib/phone";
import type { PersonRow } from "../../_types/types";

export type BalanceStatus = "toReceive" | "toPay" | "settled";

// Same sign convention as the grid cards and the person detail page's
// "Saldo na conta": positive = the user owes this person, negative = this
// person owes the user (see listPeople in actions.ts).
export function balanceStatusOf(balance: number): BalanceStatus {
  if (balance > 0) return "toPay";
  if (balance < 0) return "toReceive";
  return "settled";
}

const balanceBadgeVariant: Record<
  BalanceStatus,
  "default" | "destructive" | "secondary"
> = {
  toReceive: "default",
  toPay: "destructive",
  settled: "secondary",
};

export type PeopleColumnMessages = {
  columns: {
    person: string;
    phone: string;
    splitsCount: string;
    balance: string;
  };
  splitsCount: (count: number) => string;
  balanceStatus: (status: BalanceStatus) => string;
  viewStatement: string;
  menu: {
    edit: string;
    delete: string;
    openMenu: string;
  };
};

export type PeopleColumnActions = {
  onViewStatement: (row: PersonRow) => void;
  onEdit: (row: PersonRow) => void;
  onDelete: (row: PersonRow) => void;
};

export function getPeopleColumns(
  messages: PeopleColumnMessages,
  formatAmount: (amount: number) => string,
  actions: PeopleColumnActions,
): ColumnDef<PersonRow, unknown>[] {
  return [
    {
      id: "person",
      accessorFn: (row) => row.name,
      header: messages.columns.person,
      cell: ({ row }) => {
        const person = row.original;
        const color = getPersonColorClasses(person.name);
        return (
          <div className="flex items-center gap-2.5">
            <Avatar size="sm">
              <AvatarFallback className={cn(color.bg, color.text)}>
                {getPersonInitial(person.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{person.name}</span>
          </div>
        );
      },
    },
    {
      id: "phone",
      accessorFn: (row) => joinPersonPhone(row.phoneCountryCode, row.phone) ?? "",
      header: messages.columns.phone,
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">
          {(getValue() as string) || "—"}
        </span>
      ),
    },
    {
      accessorKey: "splitsCount",
      header: messages.columns.splitsCount,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {messages.splitsCount(row.original.splitsCount)}
        </span>
      ),
    },
    {
      accessorKey: "balance",
      header: () => <div className="text-right">{messages.columns.balance}</div>,
      cell: ({ row }) => {
        const status = balanceStatusOf(row.original.balance);
        return (
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm font-medium tabular-nums">
              {formatAmount(Math.abs(row.original.balance))}
            </span>
            <Badge variant={balanceBadgeVariant[status]}>
              {messages.balanceStatus(status)}
            </Badge>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex shrink-0 items-center justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => actions.onViewStatement(row.original)}
          >
            {messages.viewStatement}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <DotsThreeIcon />
                <span className="sr-only">{messages.menu.openMenu}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => actions.onEdit(row.original)}>
                {messages.menu.edit}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => actions.onDelete(row.original)}
              >
                {messages.menu.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
}
