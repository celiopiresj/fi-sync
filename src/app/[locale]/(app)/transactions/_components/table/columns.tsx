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
import { resolveCategoryIcon } from "@/lib/category-icons";
import { dateOnlyKey } from "@/lib/date";
import {
  CaretDownIcon,
  CaretUpIcon,
  CheckCircleIcon,
  CreditCardIcon,
  DotsThreeIcon,
  PencilSimpleIcon,
  ShuffleIcon,
  UserIcon,
} from "@phosphor-icons/react";
import type { ColumnDef } from "@tanstack/react-table";
import type { TransactionRow } from "../../_types/types";
import { formatPersonName } from "@/lib/format-person-name";
import { creditCardDetail } from "../../_lib/credit-card-detail";

type ColumnMessages = {
  columns: {
    description: string;
    account: string;
    person: string;
    amount: string;
  };
  // Shown in the Person column/subtitle when a transaction has no
  // splits at all — per the Transaction.splits doc comment in
  // prisma/schema.prisma, an empty splits array means "unattributed,
  // treat as 100% 'Eu'/self at the app layer" rather than "nobody." That
  // codepath only became reachable once Pessoa turned optional in the
  // single-transaction form (see the personId/splits comments in
  // _schema/schema.ts) — before that, splits was never actually empty.
  selfLabel: string;
  // "Dividido (N pessoas)" (table.splitPill) — the collapsed pill shown
  // in the Person column for a multi-split row; clicking it toggles the
  // per-person breakdown rows below (see renderSubRows in
  // transactions-view.tsx).
  splitPillLabel: (count: number) => string;
  // "{category} · {paymentMethod}" (table.subtitleJoin) — only called when
  // both pieces are present; a lone piece is rendered as-is, no join. For
  // a credit-card row (no paymentMethod — see the detail fallback below)
  // the second slot carries the physical card's name + installment state
  // instead, reusing the same message.
  subtitleJoin: (category: string, paymentMethod: string) => string;
  statusLabel: (status: TransactionRow["status"]) => string;
  paymentMethodLabel: (
    method: NonNullable<TransactionRow["paymentMethod"]>,
  ) => string;
  // "{number}/{count}" (table.installment) — e.g. "2/3" for the second of
  // three installments. See creditCardDetail in _lib/credit-card-detail.ts.
  installmentLabel: (number: number, count: number) => string;
  // Shown instead of installmentLabel for a credit-card purchase that
  // wasn't split into installments — "À vista".
  oneTimePaymentLabel: string;
  // Formats a credit row's real purchase date for its subtitle (see
  // creditCardDetail's own comment on why it's shown there instead of
  // the row's primary date) — callers pass e.g.
  // `(date) => format.dateTime(date, DATE_ONLY_FORMAT_OPTIONS)`.
  formatPurchaseDate: (date: Date) => string;
  // aria-label for the small credit-card icon next to the account name
  // (accountColumn below) — the icon itself has no visible text.
  creditCardAccountLabel: string;
  // aria-label for the quick "mark as completed" button shown next to a
  // PENDING row's status badge (see the description cell below) — only
  // ever rendered for PENDING, never FAILED (see transactionFormStatusValues'
  // own comment on why FAILED is excluded from user-triggered status changes).
  markCompletedAria: string;
  menuAria: string;
  menuEdit: string;
  menuDuplicate: string;
  menuDelete: string;
};

type ColumnActions = {
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

export function getTransactionColumns(
  messages: ColumnMessages,
  formatAmount: (amount: number) => string,
  actions: ColumnActions,
  // Account filtering to a single account makes the Account column
  // redundant (every visible row is the same account) — see tasks/xxx,
  // transactions screen redesign section 4. Callers decide this from
  // whichever account filter they're currently applying.
  showAccountColumn: boolean,
  // See dateColumn's own comment below — /transactions passes true,
  // /invoices' detail view passes false.
  groupByEffectiveDate: boolean,
): ColumnDef<TransactionRow, unknown>[] {
  const accountColumn: ColumnDef<TransactionRow, unknown> = {
    id: "account",
    accessorFn: (row) => row.account.name,
    header: () => <div className="w-28">{messages.columns.account}</div>,
    cell: ({ row }) => (
      <div className="flex w-28 shrink-0 items-center gap-1">
        {/* Only way to tell a credit-card account apart from a debit one
            at a glance in this column — the description subtitle already
            spells out the card/installment detail, but that's a lot of
            text to scan just to answer "is this a card?" */}
        {row.original.account.type === "CREDIT_CARD" && (
          <CreditCardIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-label={messages.creditCardAccountLabel}
          />
        )}
        <span className="truncate text-sm">{row.original.account.name}</span>
      </div>
    ),
  };

  // Grouping key for DataTable's `groupBy="date"` (transactions-view.tsx)
  // — the visible "Date" column is gone (tasks/xxx section 4: its value
  // is now shown in the group header instead, see the BUG fix in section
  // 5), but TanStack Table's grouping still needs a column definition
  // with a matching id to group by; without one, `groupBy` silently
  // no-ops and the table renders flat with no date groups at all.
  // DataTable hides this column from its header/cells automatically
  // (any column whose id matches `groupBy`), so it never actually shows.
  // Must produce the exact same "yyyy-MM-dd" string the day/accumulated
  // totals are keyed by in transactions-view.tsx — not a Date object.
  // Groups by `effectiveDate` (a credit-card row's invoice due date,
  // everything else its own date — see actions.ts) when
  // `groupByEffectiveDate` is set, else by the row's own real date.
  // /transactions wants the former; /invoices' own detail view reuses
  // this exact same column set and keeps the latter — every row in a
  // single invoice already shares one due date, so grouping by it there
  // would collapse the whole table into one group instead of one per day.
  const dateColumn: ColumnDef<TransactionRow, unknown> = {
    id: "date",
    accessorFn: (row) => dateOnlyKey(groupByEffectiveDate ? row.effectiveDate : row.date),
    enableSorting: false,
  };

  return [
    dateColumn,
    {
      accessorKey: "description",
      header: messages.columns.description,
      cell: ({ row }) => {
        const CategoryIcon = resolveCategoryIcon(row.original.category?.icon);
        // A credit-card row never has paymentMethod (implicitly "credit
        // card") — its detail slot shows the physical card's name plus
        // installment state instead, same fallback as
        // transaction-mobile-list.tsx's own.
        const detail =
          row.original.paymentMethod
            ? messages.paymentMethodLabel(row.original.paymentMethod)
            : creditCardDetail(
                row.original,
                {
                  installmentLabel: messages.installmentLabel,
                  oneTimePaymentLabel: messages.oneTimePaymentLabel,
                },
                messages.formatPurchaseDate(row.original.date),
              );
        const subtitleParts = [row.original.category?.name, detail].filter(
          (part): part is string => Boolean(part),
        );

        return (
          <div className="flex min-w-0 max-w-85 items-center gap-2.5">
            <Avatar className="size-6.5">
              <AvatarFallback
                className={row.original.category?.colorStyle || "bg-muted text-muted-foreground"}
              >
                <CategoryIcon className="size-3.5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-1.5">
                <span className="min-w-0 truncate text-sm font-medium">
                  {row.original.description}
                </span>
                {row.original.status !== "COMPLETED" && (
                  <Badge
                    variant={statusVariant[row.original.status]}
                    className="shrink-0"
                  >
                    {messages.statusLabel(row.original.status)}
                  </Badge>
                )}
                {row.original.status === "PENDING" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-5 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.onMarkCompleted(row.original);
                    }}
                  >
                    <CheckCircleIcon className="size-3.5" />
                    <span className="sr-only">{messages.markCompletedAria}</span>
                  </Button>
                )}
              </div>
              {subtitleParts.length > 0 && (
                <span className="truncate text-[11px] text-muted-foreground">
                  {subtitleParts.length === 2
                    ? messages.subtitleJoin(subtitleParts[0]!, subtitleParts[1]!)
                    : subtitleParts[0]}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    ...(showAccountColumn ? [accountColumn] : []),
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
      id: "person",
      // Sorting/filtering (if this column ever needs it) still works off
      // the joined name string — only the *cell* below switches to a
      // per-person breakdown when there's more than one split.
      accessorFn: (row) =>
        row.splits.length > 0
          ? row.splits.map((split) => formatPersonName(split.person.name)).join(", ")
          : messages.selfLabel,
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
        // More than one person — the main "Valor" column already shows
        // the transaction's total, so this collapses to a "Dividido (N
        // pessoas)" pill that expands (via row.toggleExpanded(), rendered
        // by DataTable's renderSubRows) into one indented row per person
        // below, each showing their own split amount.
        return (
          <div className="w-fit min-w-40 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                row.toggleExpanded();
              }}
              aria-expanded={row.getIsExpanded()}
              className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning transition-colors hover:bg-warning/25"
            >
              <ShuffleIcon className="size-3 shrink-0" />
              <span className="whitespace-nowrap">
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
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex shrink-0 items-center justify-end gap-0.5">
          {/* Edit is the common case (see table redesign spec, item 5) —
              surfacing it as its own hover-revealed button next to the
              menu saves a click versus opening the dropdown every time.
              opacity-0/group-hover pairs with the `group` class DataTable
              puts on each row; focus-visible covers keyboard users, who
              can Tab to it without ever hovering. Still duplicated inside
              the dropdown below for touch devices, which have no hover
              state at all. */}
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
                onSelect={() => actions.onDuplicate(row.original)}>
                {messages.menuDuplicate}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => actions.onDelete(row.original)}>
                {messages.menuDelete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
}
