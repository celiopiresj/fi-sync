"use client";

import type { ReactNode } from "react";
import { CreditCardIcon, DotsThreeIcon } from "@phosphor-icons/react";
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
import { dateOnlyKey } from "@/lib/date";
import type { TransactionRow } from "../../_types/types";
import { formatPersonName } from "@/lib/format-person-name";
import { creditCardDetail } from "../../_lib/credit-card-detail";

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
  mobileSubtitle: (category: string, paymentMethod: string, person: string) => string;
  // Shown in place of the person part when a transaction has no splits
  // at all — see the matching comment on ColumnMessages in
  // table/columns.tsx for why that's "Eu," not blank.
  selfLabel: string;
  // See the matching fields on ColumnMessages in table/columns.tsx —
  // same creditCardDetail helper, same messages.
  installmentLabel: (number: number, count: number) => string;
  oneTimePaymentLabel: string;
  creditCardAccountLabel: string;
  menuAria: string;
  menuEdit: string;
  menuDuplicate: string;
  menuDelete: string;
};

type Actions = {
  onEdit: (row: TransactionRow) => void;
  onDuplicate: (row: TransactionRow) => void;
  onDelete: (row: TransactionRow) => void;
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
  formatAmount: (amount: number) => string;
  messages: Messages;
  actions: Actions;
  emptyState: ReactNode;
};

export function TransactionMobileList({
  transactions,
  formatGroupHeader,
  formatAmount,
  messages,
  actions,
  emptyState,
}: TransactionMobileListProps) {
  if (transactions.length === 0) {
    return <div className="rounded-md border border-border">{emptyState}</div>;
  }

  // `transactions` arrives already ordered (see listTransactions:
  // orderBy date desc), so bucketing while inserting preserves that
  // order — no extra sort needed, and groups stay newest-first same as
  // the desktop table.
  const groups = new Map<string, TransactionRow[]>();
  for (const transaction of transactions) {
    const key = dateOnlyKey(transaction.date);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(transaction);
    } else {
      groups.set(key, [transaction]);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([dateKey, rows]) => {
        const { label, summary } = formatGroupHeader(dateKey);
        return (
          <div key={dateKey} className="rounded-md border border-border">
            <div className="flex flex-col gap-0.5 rounded-t-md bg-muted/50 px-3 py-2">
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {summary}
              </span>
            </div>
            <div className="divide-y divide-border">
              {rows.map((row) => {
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
                  : creditCardDetail(row, {
                      installmentLabel: messages.installmentLabel,
                      oneTimePaymentLabel: messages.oneTimePaymentLabel,
                    });
                const subtitleParts = [
                  row.category?.name ?? null,
                  detail,
                  personLabel,
                ].filter((part): part is string => Boolean(part));
                const subtitle =
                  subtitleParts.length === 3
                    ? messages.mobileSubtitle(
                        subtitleParts[0]!,
                        subtitleParts[1]!,
                        subtitleParts[2]!,
                      )
                    : subtitleParts.join(" · ");

                return (
                  <div key={row.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="relative shrink-0">
                      <CategoryIcon className="size-5 text-muted-foreground" />
                      {/* Same "is this a card?" signal as the desktop
                          table's account-column icon (columns.tsx) — this
                          list has no separate account column to put it
                          in, so it rides as a small badge on the category
                          icon instead. */}
                      {row.transactionCard && (
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
                          {row.description}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-sm font-medium tabular-nums",
                            row.amount < 0 ? "text-negative" : "text-positive",
                          )}
                        >
                          {formatAmount(row.amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {subtitle && (
                          <span className="min-w-0 truncate text-xs text-muted-foreground">
                            {subtitle}
                          </span>
                        )}
                        {row.status !== "COMPLETED" && (
                          <Badge
                            variant={statusVariant[row.status]}
                            className="shrink-0 text-[10px]"
                          >
                            {messages.statusLabel(row.status)}
                          </Badge>
                        )}
                      </div>
                      {hasMultipleSplits && (
                        <div className="mt-1 flex flex-col gap-0.5 border-t border-border/60 pt-1">
                          {row.splits.map((split) => (
                            <div
                              key={split.id}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="min-w-0 truncate text-muted-foreground">
                                {formatPersonName(split.person.name)}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 tabular-nums",
                                  split.amount < 0 ? "text-negative" : "text-positive",
                                )}
                              >
                                {formatAmount(split.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <DotsThreeIcon />
                          <span className="sr-only">{messages.menuAria}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => actions.onEdit(row)}>
                          {messages.menuEdit}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => actions.onDuplicate(row)}>
                          {messages.menuDuplicate}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => actions.onDelete(row)}
                        >
                          {messages.menuDelete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
