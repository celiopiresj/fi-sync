"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DotsThreeIcon } from "@phosphor-icons/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BALANCE_STATUS_BADGE,
  BALANCE_STATUS_TEXT,
} from "../../_constants/constants";
import { balanceStatusOf, displayBalanceOf } from "../../_lib/people-list";
import {
  getPersonColorClasses,
  getPersonInitial,
} from "../../_lib/person-avatar";
import { joinPersonPhone } from "../../_lib/phone";
import type { BalanceStatus, PersonRow } from "../../_types/types";

export { balanceStatusOf };
export type { BalanceStatus };

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
  selfBadge: string;
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
        const color = getPersonColorClasses(person.name, person.colorStyle);
        return (
          <div className="flex items-center gap-2.5">
            <Avatar size="sm">
              <AvatarFallback className={color}>
                {getPersonInitial(person.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{person.name}</span>
            {person.isSelf && (
              <Badge variant="secondary">{messages.selfBadge}</Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "phone",
      accessorFn: (row) =>
        joinPersonPhone(row.phoneCountryCode, row.phone) ?? "",
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
      header: () => (
        <div className="text-right">{messages.columns.balance}</div>
      ),
      cell: ({ row }) => {
        // A balance against yourself isn't a real debt either direction
        // — same reasoning people-view.tsx's own card rendering hides
        // this for (see its comment).
        if (row.original.isSelf) {
          return (
            <div className="text-right text-sm text-muted-foreground">—</div>
          );
        }
        const status = balanceStatusOf(row.original.balance);
        const displayBalance = displayBalanceOf(row.original.balance);
        const sign = displayBalance > 0 ? "+ " : displayBalance < 0 ? "- " : "";
        return (
          <div className="flex items-center justify-end gap-2">
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                BALANCE_STATUS_TEXT[status],
              )}>
              {sign}
              {formatAmount(Math.abs(displayBalance))}
            </span>
            <Badge variant="outline" className={BALANCE_STATUS_BADGE[status]}>
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
            onClick={() => actions.onViewStatement(row.original)}>
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
              {!row.original.isSelf && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => actions.onDelete(row.original)}>
                  {messages.menu.delete}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
}
