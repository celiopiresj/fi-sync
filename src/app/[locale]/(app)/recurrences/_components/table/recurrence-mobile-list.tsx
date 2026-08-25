"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { formatPersonName } from "@/lib/format-person-name";
import { ArrowsClockwiseIcon, CreditCardIcon, DotsThreeIcon } from "@phosphor-icons/react";
import type { RecurrenceRow } from "../../_types/types";

// Mobile counterpart to DataTable, mirroring transactions'
// TransactionMobileList (tasks/011 / tasks/012's "seguir estritamente o
// padrão"): rendered alongside the desktop table, toggled purely with
// Tailwind hidden/block classes (see recurrences-view.tsx) so server and
// client always agree on what's in the DOM. Unlike the transactions
// list, there's no date grouping here — recurrences aren't scoped to a
// day the way a transaction is, so this is just a flat two-row card per
// rule: description + amount on the first line, account/frequency/person
// on the second, plus an optional third "gerar mais" row.
type Messages = {
  frequencyLabel: (frequency: RecurrenceRow["frequency"]) => string;
  noCategory: string;
  finishedBadge: string;
  // "{account} · {frequency} · {person}" (table.cardSubtitle) — always
  // has a person (unlike transactions, personId is required here, so
  // there's no "unattributed" case to fold in).
  cardSubtitle: (account: string, frequency: string, person: string) => string;
  extendLabel: string;
  extendingLabel: string;
  creditCardAccountLabel: string;
  menuAria: string;
  menuEdit: string;
  menuDelete: string;
};

type Actions = {
  onEdit: (row: RecurrenceRow) => void;
  onDelete: (row: RecurrenceRow) => void;
  onExtend: (row: RecurrenceRow) => void;
  isExtending: (id: string) => boolean;
};

type RecurrenceMobileListProps = {
  recurrences: RecurrenceRow[];
  formatAmount: (amount: number) => string;
  messages: Messages;
  actions: Actions;
  emptyState: ReactNode;
};

export function RecurrenceMobileList({
  recurrences,
  formatAmount,
  messages,
  actions,
  emptyState,
}: RecurrenceMobileListProps) {
  if (recurrences.length === 0) {
    return <div className="rounded-md border border-border">{emptyState}</div>;
  }

  return (
    <div className="rounded-md border border-border">
      <div className="divide-y divide-border">
        {recurrences.map((recurrence) => {
          const CategoryIcon = resolveCategoryIcon(recurrence.category?.icon);
          // Every person the recurrence is split across, not just
          // splits[0] — same fix as the desktop table's own columns.tsx.
          const peopleLabel = recurrence.splits
            .map((split) => formatPersonName(split.person.name))
            .join(", ");
          const subtitle = messages.cardSubtitle(
            recurrence.account.name,
            messages.frequencyLabel(recurrence.frequency),
            peopleLabel,
          );
          const pending = actions.isExtending(recurrence.id);

          return (
            <div
              key={recurrence.id}
              className="flex flex-col gap-1.5 px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <CategoryIcon className="size-5 text-muted-foreground" />
                  {/* Same "is this a card?" signal as the desktop
                      table's account-column icon (columns.tsx) — this
                      list has no separate account column to put it in,
                      so it rides as a small badge on the category icon
                      instead. */}
                  {recurrence.account.type === "CREDIT_CARD" && (
                    <CreditCardIcon
                      weight="fill"
                      className="absolute -right-1 -bottom-1 size-2.5 rounded-full bg-background text-muted-foreground"
                      aria-label={messages.creditCardAccountLabel}
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {recurrence.description}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-medium tabular-nums",
                        recurrence.amount < 0 ? "text-negative" : "text-positive",
                      )}
                    >
                      {formatAmount(recurrence.amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {subtitle}
                    </span>
                    {!recurrence.isActive && (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {messages.finishedBadge}
                      </Badge>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <DotsThreeIcon />
                      <span className="sr-only">{messages.menuAria}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => actions.onEdit(recurrence)}>
                      {messages.menuEdit}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => actions.onDelete(recurrence)}
                    >
                      {messages.menuDelete}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {recurrence.needsExtension && (
                <button
                  type="button"
                  onClick={() => actions.onExtend(recurrence)}
                  disabled={pending}
                  className="flex w-fit items-center gap-1 pl-8 text-xs text-primary transition-colors hover:underline disabled:pointer-events-none disabled:opacity-60"
                >
                  <ArrowsClockwiseIcon className="size-3" />
                  {pending ? messages.extendingLabel : messages.extendLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
