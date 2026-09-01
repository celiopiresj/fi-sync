"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter, Link } from "@/i18n/navigation";
import { subDays } from "date-fns";
import { ArrowLeftIcon, PlusIcon, ReceiptIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SearchInput } from "@/components/screen/search-input";
import { DataTable } from "@/components/data-table/data-table";
import { renderSplitSubRows } from "@/components/data-table/split-sub-rows";
import { formatPersonName } from "@/lib/format-person-name";
import { DATE_ONLY_FORMAT_OPTIONS, dateOnlyKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { Column, Row } from "@tanstack/react-table";
import { PayInvoiceDialog } from "./pay-invoice-dialog";
import { InvoiceTransactionFiltersSheet } from "./invoice-transaction-filters-sheet";
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
  const queryClient = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionRow | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  // Same "needsInstallmentScope" swap as transactions-view.tsx's own —
  // see its comment.
  const [deleteInstallmentScope, setDeleteInstallmentScope] = useState<{
    installmentNumber: number;
    installmentCount: number;
  } | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [filters, setFilters] = useState<InvoiceTransactionFilters>({});

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
    [tTransactions, tCommon, format],
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
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["credit-card-accounts"] });
      // The edited date/account can move this purchase into a different
      // invoice entirely — re-running the Server Component is what makes
      // it disappear from this page if that just happened.
      router.refresh();
    }
    return result;
  }

  // Same "needsInstallmentScope" swap as transactions-view.tsx's own
  // performDelete — see its comment.
  async function performDelete(scope?: "this" | "all") {
    if (!deletingTransaction) return;
    setIsDeleting(true);
    const result = await deleteTransaction(
      deletingTransaction.id,
      scope ? { installmentScope: scope } : undefined,
    );
    setIsDeleting(false);

    if (result.needsInstallmentScope) {
      setDeleteInstallmentScope(result.needsInstallmentScope);
      return;
    }
    if (result.error) {
      toast.error(result.error);
      setDeletingTransaction(null);
      setDeleteInstallmentScope(null);
      return;
    }
    setDeletingTransaction(null);
    setDeleteInstallmentScope(null);
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["credit-card-accounts"] });
    toast.success(tTransactions("toast.deleted"));
    router.refresh();
  }

  async function handleDeleteConfirm() {
    await performDelete();
  }

  // Same three bulk actions as transactions-view.tsx's own (see its
  // comment on the pattern) — invalidates the same two query keys
  // handleSubmitTransaction/handleDeleteConfirm above already use, and
  // clears the selection so the toolbar closes. Categorize/status are
  // useCallback'd because `tableSelection` below closes over both.
  const handleBulkCategorize = useCallback(
    async (categoryId: string | null) => {
      setIsBulkActionPending(true);
      const result = await updateTransactionsBulk([...selectedIds], {
        categoryId,
      });
      setIsBulkActionPending(false);
      if (!result.error) {
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
        queryClient.invalidateQueries({ queryKey: ["credit-card-accounts"] });
        toast.success(tTransactions("toast.bulkCategorized", { count: result.count }));
        setSelectedIds(new Set());
        router.refresh();
      }
    },
    [selectedIds, queryClient, router, tTransactions],
  );

  const handleBulkStatusChange = useCallback(
    async (status: BulkStatus) => {
      setIsBulkActionPending(true);
      const result = await updateTransactionsBulk([...selectedIds], { status });
      setIsBulkActionPending(false);
      if (!result.error) {
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
        queryClient.invalidateQueries({ queryKey: ["credit-card-accounts"] });
        toast.success(tTransactions("toast.bulkStatusChanged", { count: result.count }));
        setSelectedIds(new Set());
        router.refresh();
      }
    },
    [selectedIds, queryClient, router, tTransactions],
  );

  async function handleBulkDeleteConfirm() {
    setIsBulkActionPending(true);
    const result = await deleteTransactionsBulk([...selectedIds]);
    setIsBulkActionPending(false);
    setIsBulkDeleteOpen(false);
    if (!result.error) {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["credit-card-accounts"] });
      toast.success(tTransactions("toast.bulkDeleted", { count: result.count }));
      setSelectedIds(new Set());
      router.refresh();
    }
  }

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  // No dedicated hook for this one-off invalidation (unlike
  // useInvoicesData's own `invalidate`) — this page has no list query of
  // its own to own the queryClient for; it just needs to tell the
  // /invoices list and /cards' available-limit figure to refetch, plus
  // re-render its own Server Component (router.refresh()) so
  // `invoice.displayStatus`/`paidAmount` reflect the just-saved PAID
  // state without a full navigation.
  function handlePaid() {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["credit-card-accounts"] });
    // Paying an invoice now creates an expense Transaction on the chosen
    // account (see payInvoice in actions.ts), which changes that
    // account's balance on /accounts.
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    // Who still owes what on this invoice just changed — refetch before
    // the dialog (or its own next open) shows stale amounts.
    queryClient.invalidateQueries({ queryKey: ["invoice-people-owed", invoice.id] });
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
    ],
  );

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <Link
        href="/invoices"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("detail.back")}
      </Link>

      <div className="flex flex-col gap-4 rounded-lg bg-surface-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold">{invoice.account.name}</h1>
            <p className="text-sm text-muted-foreground">
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
          <span className="text-xs text-muted-foreground">
            {t("detail.summary.total")}
          </span>
          <span className="text-[28px] font-medium tabular-nums text-negative">
            {money(invoice.total)}
          </span>
        </div>

        {(invoice.paidAmount || invoice.creditApplied > 0) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {invoice.paidAmount ? (
              <span>
                {t("detail.summary.paidSoFar")}{" "}
                <span className="font-medium text-positive">
                  {money(invoice.paidAmount)}
                </span>
              </span>
            ) : null}
            {invoice.creditApplied > 0 ? (
              <span>
                {t("detail.summary.creditApplied")}{" "}
                <span className="font-medium text-positive">
                  {money(invoice.creditApplied)}
                </span>
              </span>
            ) : null}
            {invoice.displayStatus !== "PAID" ? (
              <span>
                {t("detail.summary.remainingDue")}{" "}
                <span className="font-medium text-negative">
                  {money(invoice.remainingDue)}
                </span>
              </span>
            ) : null}
          </div>
        )}

        {invoice.displayStatus !== "PAID" && (
          <Button onClick={() => setPayOpen(true)} className="w-fit">
            {t("detail.markPaid.button")}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t("detail.payments.title")}</h2>

        {invoice.payments.length === 0 ? (
          <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            {t("detail.payments.empty")}
          </p>
        ) : (
          <div className="rounded-md border border-border">
            <div className="divide-y divide-border">
              {invoice.payments.map((payment) => {
                const accountName =
                  accounts.find((account) => account.id === payment.accountId)?.name ?? "";
                return (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <span className="text-sm text-muted-foreground">
                      {t("detail.payments.row", {
                        date: format.dateTime(payment.paidAt, DATE_ONLY_FORMAT_OPTIONS),
                        account: accountName,
                      })}
                    </span>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-negative">
                      {money(payment.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">{t("detail.transactions.title")}</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialogState({ mode: "create" })}
          >
            <PlusIcon />
            {t("detail.transactions.add")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder={t("detail.transactions.searchPlaceholder")}
            clearLabel={t("detail.transactions.searchClear")}
          />
          <InvoiceTransactionFiltersSheet
            filters={filters}
            onChange={setFilters}
            categories={categories}
            people={people}
          />
          {cards.length > 1 && (
            <ToggleGroup
              type="single"
              variant="tabs"
              value={activeCardId}
              onValueChange={(value) => {
                if (value) setSelectedCardId(value);
              }}
            >
              {cards.map((card) => (
                <ToggleGroupItem key={card.id} value={card.id}>
                  {card.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </div>

        {/* Same 700px cutoff as transactions-view.tsx's own DataTable/
            mobile-list split — both always mounted, toggled purely with
            Tailwind so server/client agree on what's in the DOM. */}
        <div className="hidden min-[700px]:block">
          <DataTable
            columns={columns}
            data={filteredTransactions}
            groupBy="person"
            renderGroupHeader={renderPersonGroupHeader}
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
              menuAria: tTransactions("aria.menu"),
              menuEdit: tTransactions("menu.edit"),
              menuDuplicate: tTransactions("menu.duplicate"),
              menuDelete: tTransactions("menu.delete"),
            }}
            actions={{
              onEdit: (row) => setDialogState({ mode: "edit", row }),
              onDuplicate: (row) => setDialogState({ mode: "create", prefillFrom: row }),
              onDelete: (row) => setDeletingTransaction(row),
            }}
            emptyState={emptyStateNode}
          />
        </div>
      </div>

      <PayInvoiceDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        invoiceId={invoice.id}
        remainingDue={invoice.remainingDue}
        accounts={accounts}
        onPaid={handlePaid}
      />

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
        open={deletingTransaction !== null && deleteInstallmentScope === null}
        onOpenChange={(open) => {
          if (!open) setDeletingTransaction(null);
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
            }
          }}
          installmentNumber={deleteInstallmentScope.installmentNumber}
          installmentCount={deleteInstallmentScope.installmentCount}
          isPending={isDeleting}
          onChooseScope={(scope) => performDelete(scope)}
        />
      )}

      <DeleteDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        onConfirm={handleBulkDeleteConfirm}
        isPending={isBulkActionPending}
        count={selectedIds.size}
      />
    </div>
  );
}
