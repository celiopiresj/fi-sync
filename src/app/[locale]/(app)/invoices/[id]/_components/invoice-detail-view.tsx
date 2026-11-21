"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { toast } from "sonner";
import { useRouter, Link } from "@/i18n/navigation";
import { subDays } from "date-fns";
import {
  ArrowLeftIcon,
  CaretLeftIcon,
  CaretRightIcon,
  PencilSimpleIcon,
  PlusIcon,
  ReceiptIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { SectionCard } from "@/components/screen/section-card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SearchInput } from "@/components/screen/search-input";
import { DataTable } from "@/components/data-table/data-table";
import { renderSplitSubRows } from "@/components/data-table/split-sub-rows";
import { formatPersonName } from "@/lib/format-person-name";
import { DATE_ONLY_FORMAT_OPTIONS, dateOnlyKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { Column, Row, SortingState } from "@tanstack/react-table";
import { EditPaymentDateDialog } from "./edit-payment-date-dialog";
import { PayInvoiceDialog } from "./pay-invoice-dialog";
import {
  InvoiceTransactionFiltersSheet,
  MobileInvoiceTransactionFiltersTrigger,
} from "./invoice-transaction-filters-sheet";
import { useSortGroupingMode } from "../_hooks/use-sort-grouping-mode";
import { useInvoiceDetailInvalidation } from "../_hooks/use-invoice-detail-invalidation";
import {
  InvoiceStatusBadge,
  invoiceStatusMessageKey,
} from "../../_components/invoice-status-badge";
import type { InvoiceDetail, PayableAccountOption } from "../../_types/types";
import type { InvoiceTransactionFilters } from "../_types/types";
// Deliberate cross-route dependency, not the usual per-route
// self-containment duplication (see AGENTS.md) — this reuses the exact
// same table (DataTable + columns + mobile list), edit/duplicate/delete
// flow, and search behavior /transactions itself uses, rather than
// re-implementing all of that here for a screen whose transactions are
// just a filtered slice of the same data. updateCreditTransaction in
// particular carries substantial installment-conversion/invoice-
// resolution logic that isn't worth duplicating.
import { CreditTransactionSheet } from "../../../transactions/_components/form/credit-transaction-sheet";
import { DeleteDialog } from "../../../transactions/_components/delete-dialog";
import { ConfirmPaidInvoiceDeleteDialog } from "../../../transactions/_components/confirm-paid-invoice-delete-dialog";
import { DeleteInstallmentScopeDialog } from "../../../transactions/_components/delete-installment-scope-dialog";
import { BulkActionsBar } from "../../../transactions/_components/table/bulk-actions-bar";
import { getTransactionColumns } from "../../../transactions/_components/table/columns";
import { TransactionMobileList } from "../../../transactions/_components/table/transaction-mobile-list";
import { formatGroupDateHeader } from "../../../transactions/_lib/format-group-date";
import { formatSignedAmount } from "../../../transactions/_lib/format-signed-amount";
import {
  createCreditTransaction,
  deleteTransaction,
  deleteTransactionsBulk,
  updateCreditTransaction,
  updateTransactionsBulk,
  type BulkStatus,
} from "../../../transactions/actions";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
  TransactionRow,
} from "../../../transactions/_types/types";

type InvoiceDetailViewProps = {
  invoice: InvoiceDetail;
  accounts: PayableAccountOption[];
  transactionAccounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  defaultPersonId: string | null;
};

// Same create/edit(/duplicate) union transactions-view.tsx's own
// dialogState uses — "duplicate" is mode "create" prefilled from an
// existing row (see CreditTransactionForm's toFormValues, which prefills
// regardless of isEditing). A brand-new "Adicionar transação" (no
// prefillFrom) is create mode too, just without a source row to copy —
// CreditTransactionForm falls back to this page's own defaultAccountId/
// defaultCardId/defaultDate in that case instead.
type DialogState =
  | { mode: "create"; prefillFrom?: TransactionRow }
  | { mode: "edit"; row: TransactionRow }
  | null;

// Accent-insensitive substring match — Postgres's `contains` filter
// (used server-side by listTransactions) is case- but not accent-
// insensitive, so a plain server round-trip search here would repeat the
// same "digitar sem acento não encontra" gap. This list is a small,
// already-loaded, fixed array (one invoice's worth of purchases, not a
// paginated query), so filtering client-side avoids that entirely
// instead of requiring a Postgres `unaccent` extension + migration.
function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function InvoiceDetailView({
  invoice,
  accounts,
  transactionAccounts,
  categories,
  people,
  defaultPersonId,
}: InvoiceDetailViewProps) {
  const t = useTranslations("scrn-invoices");
  const tTransactions = useTranslations("scrn-transactions");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const { invalidateAfterPayment, invalidateAfterTransactionMutation } =
    useInvoiceDetailInvalidation();
  const [payOpen, setPayOpen] = useState(false);
  // Which payment's date is being edited (its id), or null when the
  // dialog is closed — see EditPaymentDateDialog's own comment on why
  // only the date is editable here.
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const editingPayment =
    invoice.payments.find((payment) => payment.id === editingPaymentId) ?? null;
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionRow | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  // Same "needsInstallmentScope" swap as transactions-view.tsx's own —
  // see its comment.
  const [confirmPaidInvoiceOpen, setConfirmPaidInvoiceOpen] = useState(false);
  const [pendingPaidInvoiceScope, setPendingPaidInvoiceScope] = useState<"this" | "all" | undefined>(undefined);
  const [confirmPaidInvoiceBulkOpen, setConfirmPaidInvoiceBulkOpen] = useState(false);

  const [deleteInstallmentScope, setDeleteInstallmentScope] = useState<{
    installmentNumber: number;
    installmentCount: number;
  } | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [filters, setFilters] = useState<InvoiceTransactionFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [sortGroupingMode, setSortGroupingMode] = useSortGroupingMode();

  const isSorting = sorting.length > 0;
  const shouldGroupByPerson = !isSorting || sortGroupingMode === "grouped";

  function handleSortGroupingModeChange(value: string) {
    if (value !== "grouped" && value !== "flat") return;
    setSortGroupingMode(value);
    if (value === "grouped") {
      // The `person` column is hidden while grouped — drop any active sort
      // on `person` so the user isn't left with an active sort column they
      // can no longer see or click to clear.
      setSorting((prev) => prev.filter((item) => item.id !== "person"));
    }
  }

  // Same bulk-selection shape as transactions-view.tsx's own (see its
  // comment) — real Transaction ids, not row indexes, plus its own
  // open/pending flags kept separate from the single-row delete's.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkActionPending, setIsBulkActionPending] = useState(false);

  // Same allowance as transactions-view.tsx's own selectableCreditAccounts
  // — an inactive account still has to stay pickable if it's the one
  // already on the row being edited.
  const editingAccountId = dialogState?.mode === "edit" ? dialogState.row.accountId : undefined;
  const selectableCreditAccounts = transactionAccounts.filter(
    (account) =>
      account.type === "CREDIT_CARD" &&
      (account.status === "ACTIVE" || account.id === editingAccountId),
  );

  // An invoice's own account can have more than one physical card
  // (titular + additional cardholders — see fields.card.holderLabel
  // elsewhere) — when it does, each gets its own tab instead of one
  // combined table, same "only worth it once there's more than the
  // titular's own" gating the card pickers themselves follow.
  const cards = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const transaction of invoice.transactions) {
      const card = transaction.transactionCard?.card;
      if (card) byId.set(card.id, { id: card.id, name: card.name });
    }
    return [...byId.values()];
  }, [invoice.transactions]);
  const activeCardId = selectedCardId || cards[0]?.id || "";

  // Defaults for a brand-new "Adicionar transação" (no prefillFrom) —
  // `cards` above only lists cards that already have a transaction IN
  // this invoice, which is empty for a just-opened/still-empty invoice,
  // so the fallback reaches into this account's own full card list
  // instead. `closingDate - 1 day` (not `closingDate` itself, which
  // computeInvoiceCycle treats as already the START of the NEXT cycle —
  // see invoice-resolution.ts's own boundary-day comment, and not
  // "today", which could fall in a different cycle than the one being
  // viewed) is always inside this invoice's own cycle regardless of
  // when "today" actually is.
  const invoiceAccountOption = transactionAccounts.find(
    (account) => account.id === invoice.accountId,
  );
  const newTransactionDefaultCardId =
    activeCardId || invoiceAccountOption?.cards[0]?.id;
  const newTransactionDefaultDate = dateOnlyKey(
    subDays(invoice.closingDate, 1),
  );

  const transactionsForCard = useMemo(() => {
    if (cards.length <= 1) return invoice.transactions;
    return invoice.transactions.filter(
      (transaction) => transaction.transactionCard?.card?.id === activeCardId,
    );
  }, [invoice.transactions, cards.length, activeCardId]);

  const filteredTransactions = useMemo(() => {
    const query = normalizeForSearch(searchText.trim());
    const filterPerson = filters.personId
      ? people.find((person) => person.id === filters.personId)
      : null;

    return transactionsForCard.filter((transaction) => {
      if (query) {
        const haystack = normalizeForSearch(
          `${transaction.description} ${transaction.category?.name ?? ""}`,
        );
        if (!haystack.includes(query)) return false;
      }
      if (filters.categoryId && transaction.category?.id !== filters.categoryId) {
        return false;
      }
      if (filters.type && filters.type !== "all") {
        const isExpense = transaction.amount < 0;
        if (filters.type === "expenses" && !isExpense) return false;
        if (filters.type === "income" && isExpense) return false;
      }
      if (filterPerson) {
        // Same "unattributed transaction is implicitly the user's own"
        // rule listTransactions' personId filter applies server-side
        // (see actions.ts) — replicated here since this list is already
        // loaded and filtered client-side.
        const hasSplit = transaction.splits.some(
          (split) => split.personId === filterPerson.id,
        );
        const matchesSelf = filterPerson.isSelf && transaction.splits.length === 0;
        if (!hasSplit && !matchesSelf) return false;
      }
      return true;
    });
  }, [transactionsForCard, searchText, filters, people]);

  // Same day-total/accumulated-total group header math as
  // transactions-view.tsx's own (see its comment) — computed off
  // `filteredTransactions` so both the header figures and the rows
  // agree on whatever the search/card tab currently narrows down to.
  const { dailyTotalByDateKey, accumulatedByDateKey } = useMemo(() => {
    const dailyTotalByDateKey = new Map<string, number>();
    for (const transaction of filteredTransactions) {
      const key = dateOnlyKey(transaction.date);
      dailyTotalByDateKey.set(key, (dailyTotalByDateKey.get(key) ?? 0) + transaction.amount);
    }
    const orderedKeys = [...dailyTotalByDateKey.keys()].sort();
    const accumulatedByDateKey = new Map<string, number>();
    let running = 0;
    for (const key of orderedKeys) {
      running += dailyTotalByDateKey.get(key)!;
      accumulatedByDateKey.set(key, running);
    }
    return { dailyTotalByDateKey, accumulatedByDateKey };
  }, [filteredTransactions]);

  function formatGroupHeaderParts(dateKey: string) {
    const dayTotal = dailyTotalByDateKey.get(dateKey) ?? 0;
    const accumulated = accumulatedByDateKey.get(dateKey) ?? 0;
    return {
      label: formatGroupDateHeader(
        dateKey,
        {
          today: (date) => tTransactions("group.today", { date }),
          yesterday: (date) => tTransactions("group.yesterday", { date }),
          dateHeader: (weekday, date) => tTransactions("group.dateHeader", { weekday, date }),
        },
        format,
      ),
      summary: tTransactions("group.summary", {
        dayValue: format.number(dayTotal, { style: "currency", currency: "BRL" }),
        accValue: format.number(accumulated, { style: "currency", currency: "BRL" }),
      }),
    };
  }

  // Desktop table groups by person instead of date (see columns.tsx's
  // own "person" column — its accessorFn is exactly this same joined-
  // names-or-selfLabel key, which is what DataTable's groupBy="person"
  // below actually groups rows by; a split transaction becomes its own
  // group under the combined names rather than appearing under each
  // person separately, since a table row can only belong to one group).
  // Mobile keeps the date-grouped list above unchanged — TransactionMobileList's
  // own grouping is date-specific by design, not worth generalizing for
  // this one screen.
  const personTotalByKey = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of filteredTransactions) {
      const key =
        transaction.splits.length > 0
          ? transaction.splits
              .map((split) => formatPersonName(split.person.name))
              .join(", ")
          : tTransactions("table.self");
      totals.set(key, (totals.get(key) ?? 0) + transaction.amount);
    }
    return totals;
  }, [filteredTransactions, tTransactions]);

  function renderPersonGroupHeader(row: Row<TransactionRow>) {
    const personKey = row.groupingValue as string;
    const total = personTotalByKey.get(personKey) ?? 0;
    return (
      <span className="inline-flex items-center gap-2">
        <span>{personKey}</span>
        <span
          className={cn(
            "text-xs font-normal tabular-nums",
            total < 0 ? "text-negative" : "text-positive",
          )}
        >
          {formatSignedAmount(total, (value) =>
            format.number(value, { style: "currency", currency: "BRL" }),
          )}
        </span>
      </span>
    );
  }

  function renderSubRows(row: TransactionRow, columns: Column<TransactionRow, unknown>[]) {
    return renderSplitSubRows(
      row.splits.map((split) => ({
        key: split.id,
        personName: formatPersonName(split.person.name),
        amount: split.amount,
      })),
      columns,
      (amount) => formatSignedAmount(amount, (value) => format.number(value, { style: "currency", currency: "BRL" })),
    );
  }

  // Quick per-row action (status badge's own button, both table and
  // mobile list, mirroring transactions-view.tsx's own) — reuses the same
  // bulk Server Action with a single-id array. Declared before `columns`/
  // the mobile list's actions prop since both reference it.
  const handleMarkCompleted = useCallback(
    async (row: TransactionRow) => {
      const result = await updateTransactionsBulk([row.id], {
        status: "COMPLETED",
      });
      if (!result.error) {
        invalidateAfterTransactionMutation();
        toast.success(tTransactions("toast.markedCompleted"));
        router.refresh();
      }
    },
    [invalidateAfterTransactionMutation, router, tTransactions],
  );

  const columns = useMemo(
    () =>
      getTransactionColumns(
        {
          columns: {
            description: tTransactions("table.columns.description"),
            account: tTransactions("table.columns.account"),
            person: tTransactions("table.columns.person"),
            amount: tTransactions("table.columns.amount"),
          },
          selfLabel: tTransactions("table.self"),
          splitPillLabel: (count) => tTransactions("table.splitPill", { count }),
          subtitleJoin: (category, paymentMethod) =>
            tTransactions("table.subtitleJoin", { category, paymentMethod }),
          statusLabel: (status) => tCommon(`status.${status.toLowerCase()}`),
          paymentMethodLabel: (method) => tTransactions(`fields.paymentMethod.${method}`),
          installmentLabel: (number, count) => tTransactions("table.installment", { number, count }),
          oneTimePaymentLabel: tTransactions("table.oneTimePayment"),
          formatPurchaseDate: (date) => format.dateTime(date, DATE_ONLY_FORMAT_OPTIONS),
          creditCardAccountLabel: tTransactions("table.creditCardAccount"),
          markCompletedAria: tTransactions("aria.markCompleted"),
          menuAria: tTransactions("aria.menu"),
          menuEdit: tTransactions("menu.edit"),
          menuDuplicate: tTransactions("menu.duplicate"),
          menuDelete: tTransactions("menu.delete"),
        },
        (amount) =>
          formatSignedAmount(amount, (value) => format.number(value, { style: "currency", currency: "BRL" })),
        {
          onEdit: (row) => setDialogState({ mode: "edit", row }),
          onDuplicate: (row) => setDialogState({ mode: "create", prefillFrom: row }),
          onDelete: (row) => setDeletingTransaction(row),
          onMarkCompleted: handleMarkCompleted,
        },
        // Every row here already belongs to this one invoice's account —
        // an Account column would be redundant (same rule
        // transactions-view.tsx's own showAccountColumn follows when
        // filtered to a single account).
        false,
        // Keeps grouping by each row's own real purchase date — every
        // transaction on this page already belongs to the SAME invoice,
        // so grouping by due date instead would collapse the whole table
        // into a single group (see columns.tsx's dateColumn comment).
        false,
      // The desktop DataTable below groups by "person", not "date" —
      // DataTable only ever auto-hides whichever column it's actually
      // grouping by (see its own columnVisibility comment), so the
      // "date" column (built purely to be a hidden grouping key, no real
      // header/cell formatting of its own) has to be dropped here or it
      // shows up as a genuine, oddly-raw visible column instead.
      ).filter((column) => column.id !== "date"),
    [tTransactions, tCommon, format, handleMarkCompleted, setDialogState, setDeletingTransaction],
  );

  async function handleSubmitTransaction(
    values: Parameters<typeof createCreditTransaction>[0],
    options?: Parameters<typeof updateCreditTransaction>[2],
  ) {
    const isEditing = dialogState?.mode === "edit";
    const result = isEditing
      ? await updateCreditTransaction(dialogState.row.id, values, options)
      : await createCreditTransaction(values, options);

    if (!result.error) {
      toast.success(t(isEditing ? "toast.transactionUpdated" : "toast.transactionCreated"));
      invalidateAfterTransactionMutation();
      // The edited date/account can move this purchase into a different
      // invoice entirely — re-running the Server Component is what makes
      // it disappear from this page if that just happened.
      router.refresh();
    }
    return result;
  }

  // Same "needsInstallmentScope" swap as transactions-view.tsx's own
  // performDelete — see its comment.
  async function performDelete(scope?: "this" | "all", confirmPaidInvoice?: boolean) {
    if (!deletingTransaction) return;
    setIsDeleting(true);
    const result = await deleteTransaction(
      deletingTransaction.id,
      {
        ...(scope ? { installmentScope: scope } : {}),
        ...(confirmPaidInvoice ? { confirmPaidInvoice: true } : {}),
      },
    );
    setIsDeleting(false);

    if (result.needsInstallmentScope) {
      setDeleteInstallmentScope(result.needsInstallmentScope);
      return;
    }
    if (result.needsPaidInvoiceConfirmation) {
      setPendingPaidInvoiceScope(scope);
      setDeleteInstallmentScope(null);
      setConfirmPaidInvoiceOpen(true);
      return;
    }
    if (result.error) {
      toast.error(result.error);
      setDeletingTransaction(null);
      setDeleteInstallmentScope(null);
      setConfirmPaidInvoiceOpen(false);
      setPendingPaidInvoiceScope(undefined);
      return;
    }
    setDeletingTransaction(null);
    setDeleteInstallmentScope(null);
    setConfirmPaidInvoiceOpen(false);
    setPendingPaidInvoiceScope(undefined);
    invalidateAfterTransactionMutation();
    toast.success(tTransactions("toast.deleted"));
    router.refresh();
  }

  async function handleDeleteConfirm() {
    await performDelete();
  }

  const handleBulkCategorize = useCallback(
    async (categoryId: string | null) => {
      setIsBulkActionPending(true);
      const result = await updateTransactionsBulk([...selectedIds], {
        categoryId,
      });
      setIsBulkActionPending(false);
      if (!result.error) {
        invalidateAfterTransactionMutation();
        toast.success(tTransactions("toast.bulkCategorized", { count: result.count }));
        setSelectedIds(new Set());
        router.refresh();
      }
    },
    [selectedIds, invalidateAfterTransactionMutation, router, tTransactions],
  );

  const handleBulkStatusChange = useCallback(
    async (status: BulkStatus) => {
      setIsBulkActionPending(true);
      const result = await updateTransactionsBulk([...selectedIds], { status });
      setIsBulkActionPending(false);
      if (!result.error) {
        invalidateAfterTransactionMutation();
        toast.success(tTransactions("toast.bulkStatusChanged", { count: result.count }));
        setSelectedIds(new Set());
        router.refresh();
      }
    },
    [selectedIds, invalidateAfterTransactionMutation, router, tTransactions],
  );

  async function handleBulkDeleteConfirm(confirmPaidInvoice?: boolean) {
    setIsBulkActionPending(true);
    const result = await deleteTransactionsBulk([...selectedIds], { confirmPaidInvoice });
    setIsBulkActionPending(false);
    setIsBulkDeleteOpen(false);
    if (result.needsPaidInvoiceConfirmation) {
      setConfirmPaidInvoiceBulkOpen(true);
      return;
    }
    if (result.error) {
      toast.error(result.error);
      setConfirmPaidInvoiceBulkOpen(false);
      return;
    }
    setConfirmPaidInvoiceBulkOpen(false);
    invalidateAfterTransactionMutation();
    toast.success(tTransactions("toast.bulkDeleted", { count: result.count }));
    setSelectedIds(new Set());
    router.refresh();
  }

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  function handlePaid() {
    invalidateAfterPayment();
    router.refresh();
  }

  function handlePaymentDateUpdated() {
    invalidateAfterPayment();
    router.refresh();
  }

  const emptyStateNode = (
    <Empty className="border-none py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ReceiptIcon />
        </EmptyMedia>
        <EmptyTitle>{t("detail.transactions.empty")}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );

  // Same memoized selection config as transactions-view.tsx's own
  // tableSelection — kept off `filteredTransactions` (not the invoice's
  // full transaction list) so the mixed-type category filter and the
  // bulk bar's count always match whatever the search/card tab currently
  // shows, the same set a user could actually select from.
  const tableSelection = useMemo(
    () => ({
      selectedIds,
      onSelectedIdsChange: setSelectedIds,
      selectAllLabel: tTransactions("table.bulk.selectAll"),
      selectRowLabel: tTransactions("table.bulk.selectRow"),
      renderBulkActions: (ids: Set<string>) => {
        const selectedTypes = new Set<string>(
          filteredTransactions
            .filter((transaction) => ids.has(transaction.id))
            .map((transaction) => (transaction.amount < 0 ? "EXPENSE" : "INCOME")),
        );
        const isMixedSelection = selectedTypes.size > 1;
        const bulkCategories = isMixedSelection
          ? []
          : categories.filter((category) => selectedTypes.has(category.type));

        return (
          <BulkActionsBar
            selectedCount={ids.size}
            categories={bulkCategories}
            isMixedSelection={isMixedSelection}
            isPending={isBulkActionPending}
            onCategorize={handleBulkCategorize}
            onChangeStatus={handleBulkStatusChange}
            onDeleteRequest={() => setIsBulkDeleteOpen(true)}
            onClear={() => setSelectedIds(new Set())}
          />
        );
      },
    }),
    [
      selectedIds,
      filteredTransactions,
      categories,
      isBulkActionPending,
      tTransactions,
      handleBulkCategorize,
      handleBulkStatusChange,
      setSelectedIds,
      setIsBulkDeleteOpen,
    ],
  );

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/invoices"
          className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:min-h-0"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          {t("detail.back")}
        </Link>

        {(invoice.previousInvoiceId || invoice.nextInvoiceId) && (
          <div className="flex items-center gap-1">
            {invoice.previousInvoiceId ? (
              <Button variant="outline" size="icon-sm" className="size-11 md:size-8" asChild>
                <Link
                  href={`/invoices/${invoice.previousInvoiceId}`}
                  aria-label={t("detail.nav.previous")}
                >
                  <CaretLeftIcon aria-hidden="true" className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon-sm"
                className="size-11 md:size-8"
                disabled
                aria-label={t("detail.nav.previous")}
              >
                <CaretLeftIcon aria-hidden="true" className="size-4" />
              </Button>
            )}
            {invoice.nextInvoiceId ? (
              <Button variant="outline" size="icon-sm" className="size-11 md:size-8" asChild>
                <Link
                  href={`/invoices/${invoice.nextInvoiceId}`}
                  aria-label={t("detail.nav.next")}
                >
                  <CaretRightIcon aria-hidden="true" className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon-sm"
                className="size-11 md:size-8"
                disabled
                aria-label={t("detail.nav.next")}
              >
                <CaretRightIcon aria-hidden="true" className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="font-heading text-2xl font-bold tracking-tight break-words text-foreground">
                {invoice.account.name}
              </h1>
              <p className="text-sm tabular-nums text-muted-foreground">
                {t("detail.summary.period", {
                  closing: format.dateTime(invoice.closingDate, DATE_ONLY_FORMAT_OPTIONS),
                  due: format.dateTime(invoice.dueDate, DATE_ONLY_FORMAT_OPTIONS),
                })}
              </p>
            </div>
            <InvoiceStatusBadge
              status={invoice.displayStatus}
              label={t(`status.${invoiceStatusMessageKey(invoice.displayStatus)}`)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              {t("detail.summary.total")}
            </span>
            <span
              className={cn(
                "font-heading text-3xl font-bold tracking-tight tabular-nums",
                invoice.displayStatus === "PAID"
                  ? "text-positive"
                  : invoice.displayStatus === "OPEN"
                    ? "text-foreground"
                    : "text-negative",
              )}
            >
              {money(invoice.total)}
            </span>
          </div>

          {(invoice.paidAmount || invoice.creditApplied > 0) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {invoice.paidAmount ? (
                <span>
                  {t("detail.summary.paidSoFar")}{" "}
                  <span className="font-medium tabular-nums text-positive">
                    {money(invoice.paidAmount)}
                  </span>
                </span>
              ) : null}
              {invoice.creditApplied > 0 ? (
                <span>
                  {t("detail.summary.creditApplied")}{" "}
                  <span className="font-medium tabular-nums text-positive">
                    {money(invoice.creditApplied)}
                  </span>
                </span>
              ) : null}
              {invoice.displayStatus !== "PAID" ? (
                <span>
                  {t("detail.summary.remainingDue")}{" "}
                  <span className="font-medium tabular-nums text-negative">
                    {money(invoice.remainingDue)}
                  </span>
                </span>
              ) : null}
            </div>
          )}

          {invoice.displayStatus !== "PAID" && (
            <Button onClick={() => setPayOpen(true)} className="h-11 w-fit sm:h-9">
              {t("detail.markPaid.button")}
            </Button>
          )}
        </CardContent>
      </Card>

      <SectionCard title={t("detail.payments.title")} contentClassName="gap-0">
        {invoice.payments.length === 0 ? (
          <Empty className="border-none py-6">
            <EmptyHeader>
              <EmptyDescription>{t("detail.payments.empty")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="-mx-5 divide-y divide-border/60">
            {invoice.payments.map((payment) => {
              const accountName =
                accounts.find((account) => account.id === payment.accountId)?.name ?? "";
              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 px-5 py-2.5"
                >
                  <span className="min-w-0 break-words text-sm text-muted-foreground">
                    {t("detail.payments.row", {
                      date: format.dateTime(payment.paidAt, DATE_ONLY_FORMAT_OPTIONS),
                      account: accountName,
                    })}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-sm font-medium tabular-nums text-positive">
                      {money(payment.amount)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-11 md:size-8"
                      onClick={() => setEditingPaymentId(payment.id)}
                    >
                      <PencilSimpleIcon aria-hidden="true" />
                      <span className="sr-only">
                        {t("detail.payments.editDate.title")}
                      </span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold text-foreground">{t("detail.transactions.title")}</h2>
          <div className="flex items-center gap-2">
            <MobileInvoiceTransactionFiltersTrigger
              filters={filters}
              onClick={() => setFiltersOpen(true)}
            />
            <Button
              size="sm"
              variant="outline"
              className="hidden md:inline-flex"
              onClick={() => setDialogState({ mode: "create" })}
            >
              <PlusIcon aria-hidden="true" />
              {t("detail.transactions.add")}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          {cards.length > 1 && (
            <ToggleGroup
              type="single"
              variant="tabs"
              value={activeCardId}
              onValueChange={(value) => {
                if (value) setSelectedCardId(value);
              }}
              className="w-full sm:order-3 sm:w-auto"
            >
              {cards.map((card) => (
                <ToggleGroupItem
                  key={card.id}
                  value={card.id}
                  className="h-9 grow sm:h-7 sm:grow-0"
                >
                  {card.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <SearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder={t("detail.transactions.searchPlaceholder")}
            clearLabel={t("detail.transactions.searchClear")}
            className="w-full sm:order-1 sm:w-72 lg:w-85"
          />
          <InvoiceTransactionFiltersSheet
            filters={filters}
            onChange={setFilters}
            categories={categories}
            people={people}
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
          />
          <div className="hidden items-center gap-2 sm:order-4 min-[700px]:ml-auto min-[700px]:flex">
            <span className="text-xs text-muted-foreground">
              {t("detail.transactions.sortGrouping.label")}
            </span>
            <ToggleGroup
              type="single"
              variant="tabs"
              size="sm"
              value={sortGroupingMode}
              onValueChange={handleSortGroupingModeChange}
            >
              <ToggleGroupItem value="grouped">
                {t("detail.transactions.sortGrouping.grouped")}
              </ToggleGroupItem>
              <ToggleGroupItem value="flat">
                {t("detail.transactions.sortGrouping.flat")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Same 700px cutoff as transactions-view.tsx's own DataTable/
            mobile-list split — both always mounted, toggled purely with
            Tailwind so server/client agree on what's in the DOM. */}
        <div className="hidden min-[700px]:block">
          <DataTable
            columns={columns}
            data={filteredTransactions}
            sorting={sorting}
            onSortingChange={setSorting}
            groupBy={shouldGroupByPerson ? "person" : undefined}
            renderGroupHeader={shouldGroupByPerson ? renderPersonGroupHeader : undefined}
            renderSubRows={renderSubRows}
            emptyState={emptyStateNode}
            getRowId={(row) => row.id}
            selection={tableSelection}
          />
        </div>
        <div className="block min-[700px]:hidden">
          <TransactionMobileList
            transactions={filteredTransactions}
            formatGroupHeader={formatGroupHeaderParts}
            getDateKey={(row) => dateOnlyKey(row.date)}
            formatAmount={(amount) =>
              formatSignedAmount(amount, (value) => format.number(value, { style: "currency", currency: "BRL" }))
            }
            messages={{
              statusLabel: (status) => tCommon(`status.${status.toLowerCase()}`),
              paymentMethodLabel: (method) => tTransactions(`fields.paymentMethod.${method}`),
              mobileSubtitle: (category, paymentMethod, person) =>
                tTransactions("table.mobileSubtitle", { category, paymentMethod, person }),
              selfLabel: tTransactions("table.self"),
              installmentLabel: (number, count) => tTransactions("table.installment", { number, count }),
              oneTimePaymentLabel: tTransactions("table.oneTimePayment"),
              formatPurchaseDate: (date) => format.dateTime(date, DATE_ONLY_FORMAT_OPTIONS),
              creditCardAccountLabel: tTransactions("table.creditCardAccount"),
              markCompletedAria: tTransactions("aria.markCompleted"),
              menuAria: tTransactions("aria.menu"),
              menuEdit: tTransactions("menu.edit"),
              menuDuplicate: tTransactions("menu.duplicate"),
              menuDelete: tTransactions("menu.delete"),
            }}
            actions={{
              onEdit: (row) => setDialogState({ mode: "edit", row }),
              onDuplicate: (row) => setDialogState({ mode: "create", prefillFrom: row }),
              onDelete: (row) => setDeletingTransaction(row),
              onMarkCompleted: handleMarkCompleted,
            }}
            emptyState={emptyStateNode}
          />
        </div>
      </div>

      <PayInvoiceDialog
        key={`${invoice.id}-${invoice.remainingDue}`}
        open={payOpen}
        onOpenChange={setPayOpen}
        invoiceId={invoice.id}
        remainingDue={invoice.remainingDue}
        accounts={accounts}
        onPaid={handlePaid}
      />

      {editingPayment && (
        <EditPaymentDateDialog
          open={editingPaymentId !== null}
          onOpenChange={(open) => {
            if (!open) setEditingPaymentId(null);
          }}
          paymentId={editingPayment.id}
          currentPaidAt={dateOnlyKey(editingPayment.paidAt)}
          onUpdated={handlePaymentDateUpdated}
        />
      )}

      <CreditTransactionSheet
        open={dialogState !== null}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        mode={dialogState?.mode ?? "create"}
        prefill={
          dialogState?.mode === "edit"
            ? dialogState.row
            : (dialogState?.prefillFrom ?? null)
        }
        accounts={selectableCreditAccounts}
        categories={categories}
        people={people}
        defaultPersonId={defaultPersonId}
        defaultAccountId={invoice.accountId}
        defaultCardId={newTransactionDefaultCardId}
        defaultDate={newTransactionDefaultDate}
        onSubmit={handleSubmitTransaction}
        // No batch table here — CreditBatchTransactionTable has no
        // per-row defaultAccountId/defaultCardId of its own the way the
        // single form above does, and this page is specifically about
        // adding to ONE known invoice — allowBatch={false} keeps
        // CreditTransactionSheet's own toggle/table hidden, so these two
        // are never actually invoked.
        allowBatch={false}
        onSubmitBatch={async () => ({ error: null, rowIndex: null })}
        onBatchSuccess={() => {}}
      />

      <DeleteDialog
        open={
          deletingTransaction !== null &&
          deleteInstallmentScope === null &&
          !confirmPaidInvoiceOpen
        }
        onOpenChange={(open) => {
          if (!open) {
            setDeletingTransaction(null);
            setPendingPaidInvoiceScope(undefined);
          }
        }}
        onConfirm={handleDeleteConfirm}
        isPending={isDeleting}
      />

      {deleteInstallmentScope && (
        <DeleteInstallmentScopeDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDeleteInstallmentScope(null);
              setDeletingTransaction(null);
              setPendingPaidInvoiceScope(undefined);
            }
          }}
          installmentNumber={deleteInstallmentScope.installmentNumber}
          installmentCount={deleteInstallmentScope.installmentCount}
          isPending={isDeleting}
          onChooseScope={(scope) => performDelete(scope)}
        />
      )}

      <ConfirmPaidInvoiceDeleteDialog
        open={confirmPaidInvoiceOpen}
        onOpenChange={(open) => {
          setConfirmPaidInvoiceOpen(open);
          if (!open) {
            setDeletingTransaction(null);
            setPendingPaidInvoiceScope(undefined);
          }
        }}
        onConfirm={() => void performDelete(pendingPaidInvoiceScope, true)}
        isPending={isDeleting}
      />

      <DeleteDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        onConfirm={() => handleBulkDeleteConfirm()}
        isPending={isBulkActionPending}
        count={selectedIds.size}
      />

      <ConfirmPaidInvoiceDeleteDialog
        open={confirmPaidInvoiceBulkOpen}
        onOpenChange={setConfirmPaidInvoiceBulkOpen}
        onConfirm={() => void handleBulkDeleteConfirm(true)}
        isPending={isBulkActionPending}
        isBulk
      />
    </div>
  );
}
