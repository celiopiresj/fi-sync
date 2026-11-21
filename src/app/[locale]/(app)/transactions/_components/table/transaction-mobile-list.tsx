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
  CheckCircleIcon,
  CopyIcon,
  CreditCardIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { createElement, useState, type ReactNode } from "react";
import { creditCardDetail } from "../../_lib/credit-card-detail";
import type { TransactionRow } from "../../_types/types";

// Mobile counterpart to DataTable (tasks/011) — DataTable's horizontal
// table layout doesn't adapt well below `md`, so this renders the same
// data (same date grouping + daily/accumulated balance) as a card/list
// layout instead. Rendered alongside DataTable, toggled purely with
// Tailwind `hidden`/`block` classes (see transactions-view.tsx) rather
// than a `useIsMobile()` check, so the server and client always agree on
// what's in the DOM — only which one is visible differs, avoiding a
// hydration mismatch.

type Messages = {
  statusLabel: (status: TransactionRow["status"]) => string;
  paymentMethodLabel: (
    method: NonNullable<TransactionRow["paymentMethod"]>,
  ) => string;
  // "{category} · {paymentMethod} · {person}" (table.mobileSubtitle) —
  // used when all three are present, which is the common case. The
  // person part is never actually empty (an unattributed transaction —
  // `splits.length === 0` — renders `selfLabel` below, "Eu," instead of
  // nothing), so this only falls back to joining whichever parts exist
  // with the same "·" separator directly when category and/or payment
  // method is missing — there's no translatable content left to carry
  // in that fallback, just already-localized values being concatenated.
  mobileSubtitle: (
    category: string,
    paymentMethod: string,
    person: string,
  ) => string;
  // Shown in place of the person part when a transaction has no splits
  // at all — see the matching comment on ColumnMessages in
  // table/columns.tsx for why that's "Eu," not blank.
  selfLabel: string;
  // See the matching fields on ColumnMessages in table/columns.tsx —
  // same creditCardDetail helper, same messages.
  installmentLabel: (number: number, count: number) => string;
  oneTimePaymentLabel: string;
  // See the matching field on ColumnMessages in table/columns.tsx.
  formatPurchaseDate: (date: Date) => string;
  creditCardAccountLabel: string;
  // See the matching field on ColumnMessages in table/columns.tsx.
  markCompletedAria: string;
  menuAria: string;
  menuEdit: string;
  menuDuplicate: string;
  menuDelete: string;
};

type Actions = {
  onEdit: (row: TransactionRow) => void;
  onDuplicate: (row: TransactionRow) => void;
  onDelete: (row: TransactionRow) => void;
  onMarkCompleted: (row: TransactionRow) => void;
};

const statusVariant: Record<
  TransactionRow["status"],
  "default" | "secondary" | "destructive"
> = {
  PENDING: "secondary",
  COMPLETED: "default",
  FAILED: "destructive",
};

type TransactionMobileListProps = {
  transactions: TransactionRow[];
  // Returns the group header's date label (BUG-fix relative wording —
  // "Hoje, 12 de agosto") and its day/accumulated summary line, already
  // translated — see _lib/format-group-date.ts, shared with the desktop
  // table's renderGroupHeader so the two can't drift.
  formatGroupHeader: (dateKey: string) => { label: string; summary: string };
  // Which date a row groups/sorts under — /transactions groups a
  // credit-card row by its invoice's due date (`row.effectiveDate`),
  // /invoices' own detail view keeps grouping by the real purchase date
  // (`row.date`), same split as columns.tsx's own `groupByEffectiveDate`
  // param and for the same reason (every row in one invoice already
  // shares one due date).
  getDateKey: (row: TransactionRow) => string;
  formatAmount: (amount: number) => string;
  messages: Messages;
  actions: Actions;
  emptyState: ReactNode;
};

export function TransactionMobileList({
  transactions,
  formatGroupHeader,
  getDateKey,
  formatAmount,
  messages,
  actions,
  emptyState,
}: TransactionMobileListProps) {
  const [activeRow, setActiveRow] = useState<TransactionRow | null>(null);

  if (transactions.length === 0) {
    return <Card>{emptyState}</Card>;
  }

  // `transactions` arrives already ordered by whichever date basis the
  // caller's own query sorted by (see listTransactions's effectiveDate
  // resort), so bucketing while inserting preserves that order — no
  // extra sort needed, and groups stay newest-first same as the desktop
  // table.
  const groups = new Map<string, TransactionRow[]>();
  for (const transaction of transactions) {
    const key = getDateKey(transaction);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(transaction);
    } else {
      groups.set(key, [transaction]);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3.5">
        {[...groups.entries()].map(([dateKey, rows]) => {
          const { label, summary } = formatGroupHeader(dateKey);
          return (
            <Card key={dateKey} className="gap-0 overflow-hidden py-0">
              <div className="flex flex-col gap-0.5 border-b border-border/60 bg-muted/40 px-4 py-2.5">
                <span className="font-heading text-sm font-semibold text-foreground">
                  {label}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {summary}
                </span>
              </div>
              <div className="divide-y divide-border/60">
                {rows.map((row) => {
                  const color = resolveCategoryColorClasses(
                    row.category?.colorStyle ?? null,
                  );
                  const CategoryIcon = resolveCategoryIcon(row.category?.icon);
                  // More than one person splits this one differently below
                  // (each on their own line with their own amount) — the
                  // subtitle's own person slot only carries a single name
                  // ("Eu" or the lone person) in that case, same as before.
                  const hasMultipleSplits = row.splits.length > 1;
                  const personLabel = hasMultipleSplits
                    ? null
                    : row.splits.length === 1
                      ? formatPersonName(row.splits[0]!.person.name)
                      : messages.selfLabel;
                  // A credit-card row never has paymentMethod (implicitly
                  // "credit card") — its detail slot shows the physical
                  // card's name plus installment state instead, same
                  // fallback as the desktop table's own columns.tsx.
                  const detail = row.paymentMethod
                    ? messages.paymentMethodLabel(row.paymentMethod)
                    : creditCardDetail(
                        row,
                        {
                          installmentLabel: messages.installmentLabel,
                          oneTimePaymentLabel: messages.oneTimePaymentLabel,
                        },
                        messages.formatPurchaseDate(row.date),
                      );
                  // Mirrors Home's RecentTransactions: stacked one per line
                  // on phones, joined with "•" from `sm` up.
                  const details = [
                    row.category?.name ?? null,
                    detail,
                    personLabel,
                  ].filter((part): part is string => Boolean(part));

                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setActiveRow(row)}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30 active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                      <span
                        className={cn(
                          "relative flex size-9 shrink-0 items-center justify-center rounded-xl",
                          color.badge,
                        )}>
                        <CategoryIcon aria-hidden="true" className="size-4.5" />
                        {row.transactionCard && (
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
                            {row.description}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 font-heading text-sm font-semibold tabular-nums",
                              row.amount < 0
                                ? "text-negative"
                                : "text-positive",
                            )}>
                            {formatAmount(row.amount)}
                          </span>
                        </div>
                        {(details.length > 0 || row.status !== "COMPLETED") && (
                          <div className="flex items-end justify-between gap-2">
                            {details.length > 0 && (
                              <span className="flex min-w-0 flex-col text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-1.5">
                                {details.map((part, index) => (
                                  <span
                                    key={index}
                                    className="flex min-w-0 items-center gap-x-1.5">
                                    {index > 0 && (
                                      <span
                                        aria-hidden
                                        className="hidden sm:inline">
                                        •
                                      </span>
                                    )}
                                    <span className="break-words">{part}</span>
                                  </span>
                                ))}
                              </span>
                            )}
                            {row.status !== "COMPLETED" && (
                              <Badge
                                variant={
                                  row.status === "PENDING"
                                    ? "outline"
                                    : statusVariant[row.status]
                                }
                                className={cn(
                                  "shrink-0 text-[11px]",
                                  row.status === "PENDING" &&
                                    "border-warning/30 bg-warning/10 text-warning",
                                )}>
                                {messages.statusLabel(row.status)}
                              </Badge>
                            )}
                          </div>
                        )}
                        {hasMultipleSplits && (
                          <div className="mt-1 flex flex-col gap-0.5 border-t border-border/60 pt-1.5">
                            {row.splits.map((split) => (
                              <div
                                key={split.id}
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
          );
        })}
      </div>

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
                {activeRow.status === "PENDING" && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-12 w-full justify-start gap-3 rounded-xl px-3 text-sm font-medium"
                    onClick={() => {
                      const row = activeRow;
                      setActiveRow(null);
                      actions.onMarkCompleted(row);
                    }}>
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="size-5 text-positive"
                    />
                    {messages.markCompletedAria}
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
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 w-full justify-start gap-3 rounded-xl px-3 text-sm font-medium"
                  onClick={() => {
                    const row = activeRow;
                    setActiveRow(null);
                    actions.onDuplicate(row);
                  }}>
                  <CopyIcon
                    aria-hidden="true"
                    className="size-5 text-muted-foreground"
                  />
                  {messages.menuDuplicate}
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
