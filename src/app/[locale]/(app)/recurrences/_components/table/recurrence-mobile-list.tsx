"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { resolveCategoryColorClasses } from "@/lib/category-color";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { formatPersonName } from "@/lib/format-person-name";
import { cn } from "@/lib/utils";
import {
  ArrowsClockwiseIcon,
  CalendarCheckIcon,
  CreditCardIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { createElement, useState, type ReactNode } from "react";
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
  advanceLabel: string;
  advancingLabel: string;
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
  onAdvance: (row: RecurrenceRow) => void;
  isAdvancing: (id: string) => boolean;
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
  const [activeRow, setActiveRow] = useState<RecurrenceRow | null>(null);

  if (recurrences.length === 0) {
    return <Card>{emptyState}</Card>;
  }

  const activePending = activeRow ? actions.isExtending(activeRow.id) : false;
  const activeAdvancing = activeRow ? actions.isAdvancing(activeRow.id) : false;

  return (
    <>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="divide-y divide-border/60">
          {recurrences.map((recurrence) => {
            const color = resolveCategoryColorClasses(
              recurrence.category?.colorStyle ?? null,
            );
            const CategoryIcon = resolveCategoryIcon(recurrence.category?.icon);
            // More than one person splits this one differently below (each
            // on their own line with their own amount) — same fix as the
            // desktop table's own columns.tsx.
            const hasMultipleSplits = recurrence.splits.length > 1;
            const frequencyLabel = messages.frequencyLabel(
              recurrence.frequency,
            );
            // Mirrors Home's RecentTransactions: stacked one per line on
            // phones, joined with "•" from `sm` up.
            const details = [
              recurrence.account.name,
              frequencyLabel,
              hasMultipleSplits
                ? null
                : formatPersonName(recurrence.splits[0]!.person.name),
            ].filter((part): part is string => Boolean(part));

            return (
              <button
                key={recurrence.id}
                type="button"
                onClick={() => setActiveRow(recurrence)}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30 active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                <span
                  className={cn(
                    "relative flex size-9 shrink-0 items-center justify-center rounded-xl",
                    color.badge,
                  )}>
                  <CategoryIcon aria-hidden="true" className="size-4.5" />
                  {recurrence.account.type === "CREDIT_CARD" && (
                    <CreditCardIcon
                      weight="fill"
                      className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-card text-muted-foreground"
                      aria-label={messages.creditCardAccountLabel}
                    />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words text-sm font-medium text-foreground">
                      {recurrence.description}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-heading text-sm font-semibold tabular-nums",
                        recurrence.amount < 0
                          ? "text-negative"
                          : "text-positive",
                      )}>
                      {formatAmount(recurrence.amount)}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <span className="flex min-w-0 flex-col text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-1.5">
                      {details.map((part, index) => (
                        <span
                          key={index}
                          className="flex min-w-0 items-center gap-x-1.5">
                          {index > 0 && (
                            <span aria-hidden className="hidden sm:inline">
                              •
                            </span>
                          )}
                          <span className="break-words">{part}</span>
                        </span>
                      ))}
                    </span>
                    {!recurrence.isActive && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[11px]">
                        {messages.finishedBadge}
                      </Badge>
                    )}
                  </div>
                  {hasMultipleSplits && (
                    <div className="mt-1 flex flex-col gap-0.5 border-t border-border/60 pt-1.5">
                      {recurrence.splits.map((split) => (
                        <div
                          key={split.personId}
                          className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 break-words text-muted-foreground">
                            {formatPersonName(split.person.name)}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 tabular-nums",
                              split.amount < 0
                                ? "text-negative"
                                : "text-positive",
                            )}>
                            {formatAmount(split.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Drawer
        open={activeRow !== null}
        onOpenChange={(open) => {
          if (!open) setActiveRow(null);
        }}>
        <DrawerContent showCloseButton={false}>
          {activeRow && (
            <>
              <DrawerHeader className="text-left">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl",
                      resolveCategoryColorClasses(
                        activeRow.category?.colorStyle ?? null,
                      ).badge,
                    )}>
                    {createElement(
                      resolveCategoryIcon(activeRow.category?.icon),
                      {
                        "aria-hidden": true,
                        className: "size-4.5",
                      },
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <DrawerTitle className="truncate text-base">
                      {activeRow.description}
                    </DrawerTitle>
                    <DrawerDescription
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        activeRow.amount < 0
                          ? "text-negative"
                          : "text-positive",
                      )}>
                      {formatAmount(activeRow.amount)}
                    </DrawerDescription>
                  </div>
                </div>
              </DrawerHeader>

              <div className="flex flex-col gap-1 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {activeRow.needsExtension && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={activePending}
                    className="h-12 w-full justify-start gap-3 rounded-xl px-3 text-sm font-medium text-primary"
                    onClick={() => {
                      const row = activeRow;
                      setActiveRow(null);
                      actions.onExtend(row);
                    }}>
                    <ArrowsClockwiseIcon
                      aria-hidden="true"
                      className="size-5"
                    />
                    {activePending
                      ? messages.extendingLabel
                      : messages.extendLabel}
                  </Button>
                )}
                {activeRow.canAdvance && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={activeAdvancing}
                    className="h-12 w-full justify-start gap-3 rounded-xl px-3 text-sm font-medium text-primary"
                    onClick={() => {
                      const row = activeRow;
                      setActiveRow(null);
                      actions.onAdvance(row);
                    }}>
                    <CalendarCheckIcon aria-hidden="true" className="size-5" />
                    {activeAdvancing
                      ? messages.advancingLabel
                      : messages.advanceLabel}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 w-full justify-start gap-3 rounded-xl px-3 text-sm font-medium"
                  onClick={() => {
                    const row = activeRow;
                    setActiveRow(null);
                    actions.onEdit(row);
                  }}>
                  <PencilSimpleIcon
                    aria-hidden="true"
                    className="size-5 text-muted-foreground"
                  />
                  {messages.menuEdit}
                </Button>
                <Separator className="my-1" />
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 w-full justify-start gap-3 rounded-xl px-3 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    const row = activeRow;
                    setActiveRow(null);
                    actions.onDelete(row);
                  }}>
                  <TrashIcon aria-hidden="true" className="size-5" />
                  {messages.menuDelete}
                </Button>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
