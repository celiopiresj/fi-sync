"use client";

import { DataTable } from "@/components/data-table/data-table";
import { renderSplitSubRows } from "@/components/data-table/split-sub-rows";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageHeader, PeriodStepper } from "@/components/screen/page-header";
import { SearchInput } from "@/components/screen/search-input";
import {
  APP_TIME_ZONE,
  DATE_ONLY_FORMAT_OPTIONS,
  dateOnlyKey,
  parseCalendarDate,
} from "@/lib/date";
import {
  CaretDownIcon,
  ReceiptIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { Column, Row } from "@tanstack/react-table";
import { useFormatter, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTransactionFormOptions } from "../_hooks/use-transaction-form-options";
import { useTransactionsData } from "../_hooks/use-transactions-data";
import { formatGroupDateHeader } from "../_lib/format-group-date";
import { formatSignedAmount } from "../_lib/format-signed-amount";
import { accountIdForKind, resolveAccountKind } from "../_lib/account-kind";
import {
  ALL_CARDS_ACCOUNT_FILTER,
  ALL_NON_CARD_ACCOUNTS_FILTER,
  isAccountGroupFilter,
} from "../_constants/constants";
import { formatPersonName } from "@/lib/format-person-name";
import {
  resolveSpecialTransactionKind,
  type SpecialTransactionKind,
} from "../_lib/special-transaction";
import {
  currentPeriod,
  parsePeriodKey,
  periodRange,
  periodsEqual,
  shiftPeriod,
  type Period,
} from "../_lib/period";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
  SheetFilters,
  TransactionRow,
} from "../_types/types";
import {
  createCreditTransaction,
  createCreditTransactionsBatch,
  createDebitTransaction,
  createTransactionsBatch,
  createTransfer,
  deleteTransaction,
  deleteTransactionsBulk,
  updateCreditTransaction,
  updateDebitTransaction,
  updateTransactionsBulk,
  type BulkStatus,
  type TransactionFilters,
} from "../actions";
import { DeleteDialog } from "./delete-dialog";
import { DeleteInstallmentScopeDialog } from "./delete-installment-scope-dialog";
import { CreditTransactionSheet } from "./form/credit-transaction-sheet";
import { DebitTransactionSheet } from "./form/debit-transaction-sheet";
import { BulkActionsBar } from "./table/bulk-actions-bar";
import { getTransactionColumns } from "./table/columns";
import { FiltersSheet } from "./table/filters-sheet";
import { ImportStatementSheet } from "./import/import-statement-sheet";
import { TransferSheet } from "./form/transfer-sheet";
import { SpecialTransactionDialog } from "./special-transaction-dialog";
import { SummaryCards } from "./table/summary-cards";
import { TransactionMobileList } from "./table/transaction-mobile-list";

// `kind` picks which sheet renders (DebitTransactionSheet vs
// CreditTransactionSheet — tasks/015.md) — chosen explicitly from the
// "Nova transação" dropdown on create, and derived from the row's own
// account type (see kindForRow below) on edit/duplicate, so editing
// always reopens the form the row actually belongs to.
type TransactionKind = "debit" | "credit";

type DialogState =
  | { mode: "create"; kind: TransactionKind; prefillFrom?: TransactionRow }
  | { mode: "edit"; kind: TransactionKind; row: TransactionRow }
  | null;

function kindForRow(row: TransactionRow): TransactionKind {
  return row.account.type === "CREDIT_CARD" ? "credit" : "debit";
}

type TransactionsViewProps = {
  initialTransactions: TransactionRow[];
  accounts: AccountOption[];
  categories: CategoryOption[];
  initialPeople: PersonOption[];
  initialDefaultPersonId: string | null;
  // Whichever account is flagged Account.isDefault, split by which form
  // it actually applies to (see getTransactionFormOptions' own comment)
  // — null when the flagged account doesn't match that form's own type.
  // Static server-rendered props, same as `accounts`/`categories`
  // themselves: nothing changes which account is default from inside
  // this screen, so there's no TanStack Query hook for these two like
  // there is for defaultPersonId.
  defaultDebitAccountId: string | null;
  defaultCreditAccountId: string | null;
};

// Maps a chip's kind to the SheetFilters key it clears — used by both
// the chip row's remove buttons and the "kinds to render" list below.
const CHIP_FIELD = {
  account: "accountId",
  category: "categoryId",
  person: "personId",
  dateRange: "dateFrom",
  type: "type",
  dateBasis: "dateBasis",
  purchaseKind: "purchaseKind",
} as const;

// True when `value` has no filter actually applied, for the chip row's
// own visibility (hasChipFilters below — the only caller; isDefaultFilters
// is a separate plain JSON.stringify comparison). Deliberately checks
// each field's truthiness rather than `Object.keys(value).length` —
// FiltersSheet's Selects clear a filter by setting it to `undefined`,
// which leaves the key present with an unset value rather than removing
// it, so a key-presence check would keep counting it as "active" forever
// after. `accountId` additionally excludes the two group sentinels
// (_constants/constants.ts) — since the Débito/Crédito tabs added below
// always keep one of those set, treating either as "an active filter"
// would make the chip row (and its "Limpar tudo") permanently show up
// even with nothing genuinely narrowed beyond the active tab.
function hasActiveSheetFilters(value: SheetFilters): boolean {
  return Boolean(
    (value.accountId && !isAccountGroupFilter(value.accountId)) ||
      value.categoryId ||
      value.personId ||
      value.dateFrom ||
      value.dateTo ||
      (value.type && value.type !== "all") ||
      value.dateBasis === "purchase" ||
      (value.purchaseKind && value.purchaseKind !== "all"),
  );
}

export function TransactionsView({
  initialTransactions,
  accounts,
  categories,
  initialPeople,
  initialDefaultPersonId,
  defaultDebitAccountId,
  defaultCreditAccountId,
}: TransactionsViewProps) {
  const t = useTranslations("scrn-transactions");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  // Three independent pieces instead of one TransactionFilters object —
  // the period (header stepper), the free-text search (action bar), and
  // everything FiltersSheet itself still owns (account/category/type).
  // Combined into one TransactionFilters only at the query boundary
  // below, so FiltersSheet's own "Limpar filtros" can't accidentally
  // wipe out the period or search the user has set elsewhere on the
  // screen — see the SheetFilters comment in _types/types.ts.
  // `?month=yyyy-MM` (set by the projections screen's "Ver extrato"
  // link) opens the screen already scoped to that month instead of the
  // current one — page.tsx's own initial fetch mirrors this same
  // resolution so the two can't disagree on what "the default" is.
  // `?person=`/`?category=`/`?type=`/`?account=` (set the same way
  // `?month=` is — the projections screen's "Ver extrato" link,
  // tasks/016, and the account detail screen's per-person rows) seed the
  // sheet's own filters too, so a link can open the screen already
  // scoped to a specific person/category/account/income-or-expense
  // instead of just the month.
  const searchParams = useSearchParams();
  const [initialPeriod] = useState(
    () => parsePeriodKey(searchParams.get("month")) ?? currentPeriod(),
  );
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [initialSheetFilters] = useState<SheetFilters>(() => {
    const personId = searchParams.get("person") ?? undefined;
    const categoryId = searchParams.get("category") ?? undefined;
    const typeParam = searchParams.get("type");
    const type =
      typeParam === "income" || typeParam === "expenses" ? typeParam : undefined;
    // Débito is the screen's default tab (see the accountKind toggle
    // below) — page.tsx's own initial fetch mirrors this exact same
    // default so the cache seed stays valid (same reasoning as
    // isDefaultFilters' own comment). An explicit `?account=` wins over
    // it: the tab that shows active is derived from whatever accountId
    // ends up here (resolveAccountKind below), so a card account linked
    // to opens on Crédito without needing its own param.
    const accountId = searchParams.get("account") || ALL_NON_CARD_ACCOUNTS_FILTER;
    return { personId, categoryId, type, accountId };
  });
  const [sheetFilters, setSheetFilters] = useState<SheetFilters>(initialSheetFilters);
  const [searchText, setSearchText] = useState("");

  // Derived from `sheetFilters.accountId` (never its own separate state)
  // so the Débito/Crédito tabs and FiltersSheet's own Conta/Cartão
  // selects can never disagree — whichever last set `accountId` decides
  // which tab shows active. Clicking a tab broadens back to "every
  // account of this kind," discarding any more specific account
  // FiltersSheet had narrowed to.
  const accountKind = resolveAccountKind(sheetFilters.accountId, accounts);
  function handleAccountKindChange(kind: typeof accountKind) {
    setSheetFilters((current) => {
      const next = { ...current, accountId: accountIdForKind(kind) };
      // Crédito-only refinements (see SheetFilters) — dropped on leaving
      // that tab so they don't linger as hidden chips on Débito.
      if (kind !== "credit") {
        delete next.dateBasis;
        delete next.purchaseKind;
      }
      return next;
    });
  }

  const [dialogState, setDialogState] = useState<DialogState>(null);
  // Set instead of dialogState whenever the row being "edited" is a
  // special one (resolveSpecialTransactionKind) — swaps the normal
  // debit/credit edit sheet for SpecialTransactionDialog's own
  // redirect-to-the-real-owner explanation.
  const [specialTransaction, setSpecialTransaction] =
    useState<SpecialTransactionKind | null>(null);
  // Its own flag rather than another DialogState kind: the import sheet
  // has no mode/prefill/row of its own, and folding it into that union
  // would make every `dialogState.kind === "debit"` check upstream carry
  // a case that can never apply to it.
  const [importOpen, setImportOpen] = useState(false);
  // Same "own flag, not a DialogState kind" reasoning as importOpen: a
  // transfer is create-only, and its legs never reopen in this sheet
  // (they're special rows — see resolveSpecialTransactionKind).
  const [transferOpen, setTransferOpen] = useState(false);
  const [deletingTransaction, setDeletingTransaction] =
    useState<TransactionRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Set once deleteTransaction reports `needsInstallmentScope` — swaps
  // the plain DeleteDialog for DeleteInstallmentScopeDialog's "esta
  // parcela ou todas?" choice instead. Cleared alongside
  // deletingTransaction on cancel/success.
  const [deleteInstallmentScope, setDeleteInstallmentScope] = useState<{
    installmentNumber: number;
    installmentCount: number;
  } | null>(null);

  // Table multi-select (redesign spec item 4) — `selectedIds` holds real
  // Transaction ids (see DataTable's `getRowId` below), not row indexes,
  // so a bulk action always targets the rows the user actually meant even
  // if sorting/grouping shuffled positions in between. Bulk delete gets
  // its own open/pending flags rather than reusing `deletingTransaction`/
  // `isDeleting` above — that pair is specifically "confirm deleting THIS
  // one row" and shouldn't have to grow a union type just to also mean
  // "confirm deleting the whole selection."
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkActionPending, setIsBulkActionPending] = useState(false);

  const { from, to } = useMemo(() => periodRange(period), [period]);
  // `sheetFilters.dateFrom`/`dateTo` (the filter sheet's own custom
  // range) override the period stepper's own from/to on whichever side
  // is actually set — picking just "De" keeps the stepper's own end of
  // month, and vice versa. Reconstructed explicitly (not `...sheetFilters`)
  // so `dateFrom`/`dateTo` — not real TransactionFilters keys — never
  // leak into the object passed to listTransactions.
  const filters: TransactionFilters = useMemo(
    () => ({
      accountId: sheetFilters.accountId,
      categoryId: sheetFilters.categoryId,
      personId: sheetFilters.personId,
      type: sheetFilters.type,
      dateBasis: sheetFilters.dateBasis,
      purchaseKind: sheetFilters.purchaseKind,
      search: searchText.trim() || undefined,
      from: sheetFilters.dateFrom || from,
      to: sheetFilters.dateTo || to,
    }),
    [sheetFilters, searchText, from, to],
  );

  // Selection is scoped to "whatever's currently visible" — once the
  // period/account/category/type/search changes, the previously-selected
  // ids may no longer even be in `transactions`, so the bulk bar
  // shouldn't linger showing a stale count. Reset during render (React's
  // "adjusting state when a prop changes" pattern — see
  // https://react.dev/learn/you-might-not-need-an-effect) rather than in
  // a useEffect: an effect would still commit one frame with the stale
  // selection before clearing it, and react-hooks flags a bare
  // setState-in-effect like this one as a cascading-render risk. `filters`
  // is itself memoized above, so this only fires on an actual filter
  // change, not every render.
  const [prevFilters, setPrevFilters] = useState(filters);
  if (filters !== prevFilters) {
    setPrevFilters(filters);
    setSelectedIds(new Set());
  }

  // Drives SummaryCards' "R$470 acima de julho"-style comparison — same
  // account/category/type/search scope as the current period's own
  // query (so the two figures being compared are apples to apples), just
  // shifted one month back.
  const previousPeriod = useMemo(() => shiftPeriod(period, -1), [period]);
  const previousRange = useMemo(
    () => periodRange(previousPeriod),
    [previousPeriod],
  );
  // Always period-based (ignores sheetFilters.dateFrom/dateTo, unlike
  // `filters` above) — "the same period, one month back" doesn't have an
  // obvious equivalent once a custom range is in play.
  const previousFilters: TransactionFilters = useMemo(
    () => ({
      accountId: sheetFilters.accountId,
      categoryId: sheetFilters.categoryId,
      personId: sheetFilters.personId,
      type: sheetFilters.type,
      dateBasis: sheetFilters.dateBasis,
      purchaseKind: sheetFilters.purchaseKind,
      search: searchText.trim() || undefined,
      from: previousRange.from,
      to: previousRange.to,
    }),
    [sheetFilters, searchText, previousRange],
  );

  // page.tsx now fetches exactly this default (current period + whatever
  // sheet filters the URL itself specified) for `initialTransactions` —
  // this mirrors that condition so the cache seed is only trusted while
  // nothing's actually changed from what the server used to produce it
  // (see the comment in page.tsx). Compares against `initialSheetFilters`
  // (the URL-seeded snapshot), not "no filters at all" — a `?person=`
  // link's starting state IS the default for this session.
  const isDefaultFilters =
    JSON.stringify(sheetFilters) === JSON.stringify(initialSheetFilters) &&
    searchText === "" &&
    periodsEqual(period, initialPeriod);

  const { transactions, previousTransactions, invalidate, isFetching } =
    useTransactionsData(
      filters,
      previousFilters,
      initialTransactions,
      isDefaultFilters,
    );
  const { people, defaultPersonId } = useTransactionFormOptions(
    initialPeople,
    initialDefaultPersonId,
  );

  // Per-day total AND running/accumulated total over whatever's
  // currently loaded (respects `filters`) — this app doesn't store an
  // absolute Account.balance to anchor against, so "Acum." is relative
  // to the visible window, not a bank-synced balance. BUG fix (tasks/xxx
  // section 5): the group header used to show only the accumulated
  // figure, unlabeled, which reads as if it were the day's own total.
  // Both maps are needed to label it correctly below.
  const { dailyTotalByDateKey, accumulatedByDateKey } = useMemo(() => {
    const dailyTotalByDateKey = new Map<string, number>();
    for (const transaction of transactions) {
      const key = dateOnlyKey(transaction.effectiveDate);
      dailyTotalByDateKey.set(
        key,
        (dailyTotalByDateKey.get(key) ?? 0) + transaction.amount,
      );
    }
    const orderedKeys = [...dailyTotalByDateKey.keys()].sort(); // "yyyy-MM-dd" sorts chronologically
    const accumulatedByDateKey = new Map<string, number>();
    let running = 0;
    for (const key of orderedKeys) {
      running += dailyTotalByDateKey.get(key)!;
      accumulatedByDateKey.set(key, running);
    }
    return { dailyTotalByDateKey, accumulatedByDateKey };
  }, [transactions]);

  // The transaction forms/batch table should only offer active accounts
  // (tasks/007: archived accounts disappear from transaction pickers) —
  // but editing a transaction that already points at a since-archived
  // account should still show it selected rather than looking blank.
  // FiltersSheet is deliberately NOT filtered this way: filtering the
  // transaction *list* by an old, now-inactive account is still useful.
  // Split by account type (tasks/015.md: debit and credit are separate
  // forms with separate account pickers) rather than one combined list.
  // Investment/pocket accounts are excluded too — aporte/resgate against
  // them only ever goes through the dedicated Investments screen now
  // (investments/actions.ts's own createInvestmentMovement posts both
  // transfer legs), never this general debit form.
  const selectableDebitAccounts = useMemo(() => {
    const editingAccountId =
      dialogState?.mode === "edit" ? dialogState.row.accountId : undefined;
    return accounts.filter(
      (account) =>
        (account.type === "CHECKING" ||
          account.type === "SAVINGS" ||
          account.type === "CASH") &&
        (account.status === "ACTIVE" || account.id === editingAccountId),
    );
  }, [accounts, dialogState]);

  const selectableCreditAccounts = useMemo(() => {
    const editingAccountId =
      dialogState?.mode === "edit" ? dialogState.row.accountId : undefined;
    return accounts.filter(
      (account) =>
        account.type === "CREDIT_CARD" &&
        (account.status === "ACTIVE" || account.id === editingAccountId),
    );
  }, [accounts, dialogState]);

  // Shared with the mobile list (transaction-mobile-list.tsx) via the
  // `formatGroupHeader` prop so the BUG-fix wording can't drift between
  // the two.
  function formatGroupHeaderParts(dateKey: string) {
    const dayTotal = dailyTotalByDateKey.get(dateKey) ?? 0;
    const accumulated = accumulatedByDateKey.get(dateKey) ?? 0;
    return {
      label: formatGroupDateHeader(
        dateKey,
        {
          today: (date) => t("group.today", { date }),
          yesterday: (date) => t("group.yesterday", { date }),
          dateHeader: (weekday, date) =>
            t("group.dateHeader", { weekday, date }),
        },
        format,
      ),
      summary: t("group.summary", {
        dayValue: format.number(dayTotal, {
          style: "currency",
          currency: "BRL",
        }),
        accValue: format.number(accumulated, {
          style: "currency",
          currency: "BRL",
        }),
      }),
    };
  }

  function renderGroupHeader(row: Row<TransactionRow>) {
    const dateKey = row.groupingValue as string;
    const { label, summary } = formatGroupHeaderParts(dateKey);
    return (
      <span className="inline-flex items-center gap-2">
        <span>{label}</span>
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          {summary}
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
      (amount) =>
        formatSignedAmount(amount, (value) =>
          format.number(value, { style: "currency", currency: "BRL" }),
        ),
    );
  }

  // Quick per-row action (status badge's own button, both table and mobile
  // list) — reuses the same bulk Server Action with a single-id array
  // rather than a dedicated one, same as the bulk toolbar's own status
  // change further below. Declared before `columns`/the mobile list's
  // actions prop since both reference it.
  const handleMarkCompleted = useCallback(
    async (row: TransactionRow) => {
      const result = await updateTransactionsBulk([row.id], {
        status: "COMPLETED",
      });
      if (!result.error) {
        invalidate();
        toast.success(t("toast.markedCompleted"));
      }
    },
    [invalidate, t],
  );

  // Shared "Editar" entry point for both the table and the mobile list
  // (their own actions.onEdit below) — a special row (see
  // resolveSpecialTransactionKind's own comment) opens
  // SpecialTransactionDialog instead of the plain debit/credit sheet,
  // which has no idea how to edit an opening balance, an investment
  // movement, a loan installment, or an invoice payment without
  // desyncing whatever screen actually owns it.
  const handleEditRow = useCallback((row: TransactionRow) => {
    const special = resolveSpecialTransactionKind(row);
    if (special) {
      setSpecialTransaction(special);
      return;
    }
    setDialogState({ mode: "edit", kind: kindForRow(row), row });
  }, []);

  const columns = useMemo(
    () =>
      getTransactionColumns(
        {
          columns: {
            description: t("table.columns.description"),
            account: t("table.columns.account"),
            person: t("table.columns.person"),
            amount: t("table.columns.amount"),
          },
          selfLabel: t("table.self"),
          splitPillLabel: (count) => t("table.splitPill", { count }),
          subtitleJoin: (category, paymentMethod) =>
            t("table.subtitleJoin", { category, paymentMethod }),
          statusLabel: (status) => tCommon(`status.${status.toLowerCase()}`),
          paymentMethodLabel: (method) => t(`fields.paymentMethod.${method}`),
          installmentLabel: (number, count) => t("table.installment", { number, count }),
          oneTimePaymentLabel: t("table.oneTimePayment"),
          formatPurchaseDate: (date) => format.dateTime(date, DATE_ONLY_FORMAT_OPTIONS),
          creditCardAccountLabel: t("table.creditCardAccount"),
          markCompletedAria: t("aria.markCompleted"),
          menuAria: t("aria.menu"),
          menuEdit: t("menu.edit"),
          menuDuplicate: t("menu.duplicate"),
          menuDelete: t("menu.delete"),
        },
        (amount) =>
          formatSignedAmount(amount, (value) =>
            format.number(value, { style: "currency", currency: "BRL" }),
          ),
        {
          onEdit: handleEditRow,
          onDuplicate: (row) =>
            setDialogState({
              mode: "create",
              kind: kindForRow(row),
              prefillFrom: row,
            }),
          onDelete: (row) => setDeletingTransaction(row),
          onMarkCompleted: handleMarkCompleted,
        },
        // Filtering to one SPECIFIC account makes an Account column
        // redundant (tasks/xxx section 4) — a group sentinel doesn't
        // count (the Débito/Crédito tabs keep one set at all times, and
        // rows within a kind still span several different accounts).
        !sheetFilters.accountId || isAccountGroupFilter(sheetFilters.accountId),
        // Group by each credit-card row's invoice due date, not its own
        // purchase date — see columns.tsx's dateColumn comment.
        true,
      ),
    [t, tCommon, format, sheetFilters.accountId, handleMarkCompleted, handleEditRow],
  );

  // Dispatches to the create/update action matching whichever sheet is
  // currently open (tasks/015.md: debit and credit are separate Server
  // Actions, each with their own schema) — DebitTransactionSheet and
  // CreditTransactionSheet each only ever call the handler matching their
  // own form-values type, so the cast here just satisfies the shared
  // `dialogState.kind` narrowing TypeScript can't otherwise see through
  // two independently-typed onSubmit props.
  async function handleSubmitDebit(
    values: Parameters<typeof createDebitTransaction>[0],
  ) {
    const isEditing = dialogState?.mode === "edit";
    const result = isEditing
      ? await updateDebitTransaction(dialogState.row.id, values)
      : await createDebitTransaction(values);

    if (!result.error) {
      invalidate();
      toast.success(t(isEditing ? "toast.updated" : "toast.created"));
    }

    return result;
  }

  async function handleSubmitCredit(
    values: Parameters<typeof createCreditTransaction>[0],
    options?: Parameters<typeof updateCreditTransaction>[2],
  ) {
    const isEditing = dialogState?.mode === "edit";
    const result = isEditing
      ? await updateCreditTransaction(dialogState.row.id, values, options)
      : await createCreditTransaction(values, options);

    if (!result.error) {
      invalidate();
      toast.success(t(isEditing ? "toast.updated" : "toast.created"));
    }

    return result;
  }

  async function handleSubmitBatch(
    rows: Parameters<typeof createTransactionsBatch>[0],
  ) {
    const result = await createTransactionsBatch(rows);
    if (!result.error) {
      invalidate();
    }
    return result;
  }

  async function handleSubmitCreditBatch(
    rows: Parameters<typeof createCreditTransactionsBatch>[0],
  ) {
    const result = await createCreditTransactionsBatch(rows);
    if (!result.error) {
      invalidate();
    }
    return result;
  }

  async function handleSubmitTransfer(
    values: Parameters<typeof createTransfer>[0],
  ) {
    const result = await createTransfer(values);
    if (!result.error) {
      invalidate();
      toast.success(t("toast.transferCreated"));
    }
    return result;
  }

  // Shared by both batch tables — same "N criadas" toast regardless of
  // which kind was queued.
  function handleBatchSuccess(count: number) {
    toast.success(t("toast.batchCreated", { count }));
  }

  // Shared by the plain DeleteDialog's confirm (no scope yet) and
  // DeleteInstallmentScopeDialog's own choice — deleteTransaction
  // (actions.ts) reports `needsInstallmentScope` the first time it's
  // called on an installment-group row without one, which is what
  // swaps DeleteDialog for the scope dialog instead of deleting
  // anything yet.
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
    invalidate();
    toast.success(t("toast.deleted"));
  }

  async function handleDeleteConfirm() {
    await performDelete();
  }

  // The three bulk actions (BulkActionsBar, rendered by DataTable's
  // `selection.renderBulkActions` below) all follow the same shape: run,
  // invalidate on success (also covers the summary card's two chart
  // queries — a bulk categorize/delete changes "Onde foi o gasto" too),
  // toast with the SERVER's affected count rather than selectedIds.size
  // (an id that no longer belongs to a visible row, e.g. deleted from
  // another tab in between, is silently skipped server-side), and clear
  // the selection so the toolbar closes.
  //
  // Categorize/status are useCallback'd (and `invalidate` above is too)
  // because `tableSelection` below closes over both — without a stable
  // identity here, that memo would recompute every render regardless of
  // its own dependency array, which defeats the whole point of memoizing
  // it. handleBulkDeleteConfirm doesn't need the same treatment: it's
  // only ever passed as a plain JSX prop (to the bulk DeleteDialog), the
  // same as handleDeleteConfirm above, never through a memo.
  const handleBulkCategorize = useCallback(
    async (categoryId: string | null) => {
      setIsBulkActionPending(true);
      const result = await updateTransactionsBulk([...selectedIds], {
        categoryId,
      });
      setIsBulkActionPending(false);
      if (!result.error) {
        invalidate();
        toast.success(t("toast.bulkCategorized", { count: result.count }));
        setSelectedIds(new Set());
      }
    },
    [selectedIds, invalidate, t],
  );

  const handleBulkStatusChange = useCallback(
    async (status: BulkStatus) => {
      setIsBulkActionPending(true);
      const result = await updateTransactionsBulk([...selectedIds], { status });
      setIsBulkActionPending(false);
      if (!result.error) {
        invalidate();
        toast.success(t("toast.bulkStatusChanged", { count: result.count }));
        setSelectedIds(new Set());
      }
    },
    [selectedIds, invalidate, t],
  );

  async function handleBulkDeleteConfirm() {
    setIsBulkActionPending(true);
    const result = await deleteTransactionsBulk([...selectedIds]);
    setIsBulkActionPending(false);
    setIsBulkDeleteOpen(false);
    if (!result.error) {
      invalidate();
      toast.success(t("toast.bulkDeleted", { count: result.count }));
      setSelectedIds(new Set());
    }
  }

  // SummaryCards' "Saldo mensal" bars pass back the ISO "yyyy-MM" they
  // represent (see getMonthlyBalances in actions.ts) — this is the only
  // place that needs to know Period's {year, month} shape, so the
  // conversion lives here rather than inside the chart component.
  function handleSelectMonth(month: string) {
    const [year, monthNumber] = month.split("-").map(Number);
    setPeriod({ year: year!, month: monthNumber! - 1 });
  }

  // SummaryCards' "Onde foi o gasto" rows apply that category to the
  // same FiltersSheet state the filter sheet itself edits, so the chip
  // row/clear-all above the table stays the single source of truth for
  // "what's filtered" regardless of where the filter was set from.
  function handleSelectCategory(categoryId: string) {
    setSheetFilters((current) => ({ ...current, categoryId }));
  }

  // `from`/`previousRange.from` are already "yyyy-MM-dd" strings scoped
  // to APP_TIME_ZONE (see _lib/period.ts) — parseCalendarDate turns them
  // into the correct instant to format, same helper the rest of the app
  // uses for any client-computed (not @db.Date-read) date value.
  const periodStartDate = useMemo(() => parseCalendarDate(from), [from]);
  const previousPeriodStartDate = useMemo(
    () => parseCalendarDate(previousRange.from),
    [previousRange],
  );
  const periodStepperLabel = format.dateTime(periodStartDate, {
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  });
  const periodMonthNameLong = format.dateTime(periodStartDate, {
    month: "long",
    timeZone: APP_TIME_ZONE,
  });

  // The account filter's value is either a real account id, or one of the
  // two "every card"/"every non-card account" sentinels (filters-sheet.tsx)
  // — resolved here to whatever display name each of those needs, shared
  // by the header subtitle and the removable filter chip below.
  function accountFilterName(accountId: string): string {
    if (accountId === ALL_CARDS_ACCOUNT_FILTER) return t("filters.allCards");
    if (accountId === ALL_NON_CARD_ACCOUNTS_FILTER) {
      return t("filters.allNonCardAccounts");
    }
    return accounts.find((account) => account.id === accountId)?.name ?? "";
  }

  const selectedAccountName = useMemo(() => {
    if (!sheetFilters.accountId) return null;
    return accountFilterName(sheetFilters.accountId) || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, sheetFilters.accountId]);

  const headerSubtitle = t("header.subtitle", {
    account: selectedAccountName ?? t("filters.allAccounts"),
    count: transactions.length,
  });

  const hasChipFilters = hasActiveSheetFilters(sheetFilters);

  function chipLabel(kind: keyof typeof CHIP_FIELD): string | null {
    // A group sentinel ("Todas as contas"/"Todos os cartões") is just
    // which Débito/Crédito tab is active, not a real narrowing — only a
    // specific account earns a removable chip here (see
    // isAccountGroupFilter's own comment).
    if (
      kind === "account" &&
      sheetFilters.accountId &&
      !isAccountGroupFilter(sheetFilters.accountId)
    ) {
      return t("filters.chips.account", {
        value: accountFilterName(sheetFilters.accountId),
      });
    }
    if (kind === "category" && sheetFilters.categoryId) {
      const name =
        categories.find((category) => category.id === sheetFilters.categoryId)
          ?.name ?? "";
      return t("filters.chips.category", { value: name });
    }
    if (kind === "person" && sheetFilters.personId) {
      const name =
        people.find((person) => person.id === sheetFilters.personId)?.name ?? "";
      return t("filters.chips.person", { value: name });
    }
    if (kind === "dateRange" && (sheetFilters.dateFrom || sheetFilters.dateTo)) {
      // Both are parseCalendarDate'd user input (from the sheet's own
      // `<input type="date">`), not values read back from a @db.Date
      // column — the plain dateStyle formatter (APP_TIME_ZONE, applied
      // globally by next-intl's own config) is correct here, not
      // DATE_ONLY_FORMAT_OPTIONS' UTC override (src/lib/date.ts).
      const fromDate = sheetFilters.dateFrom
        ? format.dateTime(parseCalendarDate(sheetFilters.dateFrom), { dateStyle: "short" })
        : null;
      const toDate = sheetFilters.dateTo
        ? format.dateTime(parseCalendarDate(sheetFilters.dateTo), { dateStyle: "short" })
        : null;
      const value = [fromDate, toDate].filter(Boolean).join(" – ");
      return t("filters.chips.dateRange", { value });
    }
    if (kind === "type" && sheetFilters.type && sheetFilters.type !== "all") {
      return t("filters.chips.type", { value: t(`tabs.${sheetFilters.type}`) });
    }
    if (kind === "dateBasis" && sheetFilters.dateBasis === "purchase") {
      return t("filters.chips.dateBasis", { value: t("filters.dateBasis.purchase") });
    }
    if (
      kind === "purchaseKind" &&
      sheetFilters.purchaseKind &&
      sheetFilters.purchaseKind !== "all"
    ) {
      return t("filters.chips.purchaseKind", {
        value: t(`filters.purchaseKind.${sheetFilters.purchaseKind}`),
      });
    }
    return null;
  }

  function removeChip(kind: keyof typeof CHIP_FIELD) {
    setSheetFilters((current) => {
      // `delete` (not `= undefined`) so the key actually disappears,
      // keeping `sheetFilters` free of stale unset keys — hasActiveSheetFilters
      // (used by isDefaultFilters/hasChipFilters) checks truthiness rather
      // than key presence either way, but there's no reason to leave a
      // dangling `accountId: undefined` around once it's cleared.
      const next = { ...current };
      // Broadens back to "every account of this kind" rather than
      // deleting the key outright — an actually-unset accountId would
      // put the screen back in the old "both kinds mixed" state the
      // Débito/Crédito tabs no longer make reachable (see
      // resolveAccountKind's own comment).
      if (kind === "account") {
        next.accountId = accountIdForKind(resolveAccountKind(current.accountId, accounts));
      }
      if (kind === "category") delete next.categoryId;
      if (kind === "person") delete next.personId;
      if (kind === "dateRange") {
        delete next.dateFrom;
        delete next.dateTo;
      }
      if (kind === "type") delete next.type;
      if (kind === "dateBasis") delete next.dateBasis;
      if (kind === "purchaseKind") delete next.purchaseKind;
      return next;
    });
  }

  const emptyStateNode = (
    <Empty className="border-none py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ReceiptIcon />
        </EmptyMedia>
        <EmptyTitle>
          {t("table.empty.titleWithPeriod", { month: periodMonthNameLong })}
        </EmptyTitle>
        <EmptyDescription>{t("table.empty.description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          size="sm"
          onClick={() => setDialogState({ mode: "create", kind: "debit" })}>
          {t("table.empty.button")}
        </Button>
      </EmptyContent>
    </Empty>
  );

  // Memoized so DataTable's own `tableColumns` memo (keyed on this whole
  // object) doesn't recompute on every render — only when the selection,
  // the category list, or the pending flag actually change.
  const tableSelection = useMemo(
    () => ({
      selectedIds,
      onSelectedIdsChange: setSelectedIds,
      selectAllLabel: t("table.bulk.selectAll"),
      selectRowLabel: t("table.bulk.selectRow"),
      renderBulkActions: (ids: Set<string>) => {
        // Same "only categories matching the transaction's own type"
        // rule the create/edit forms' pickers follow — a bulk selection
        // spanning both income and expense rows has no single type to
        // filter by, so it offers no categories at all rather than a
        // list that would be wrong for half the selection.
        const selectedTypes = new Set<string>(
          transactions
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
      transactions,
      categories,
      isBulkActionPending,
      t,
      handleBulkCategorize,
      handleBulkStatusChange,
    ],
  );

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={headerSubtitle}
        right={
          <PeriodStepper
            label={periodStepperLabel}
            onPrevious={() => setPeriod((current) => shiftPeriod(current, -1))}
            onNext={() => setPeriod((current) => shiftPeriod(current, 1))}
            previousLabel={t("header.previousPeriod")}
            nextLabel={t("header.nextPeriod")}
          />
        }
      />

      <SummaryCards
        transactions={transactions}
        previousTransactions={previousTransactions}
        previousPeriodDate={previousPeriodStartDate}
        accountId={sheetFilters.accountId}
        period={period}
        filters={filters}
        accountKind={accountKind}
        onSelectMonth={handleSelectMonth}
        onSelectCategory={handleSelectCategory}
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {/* Search + filters + the Débito/Crédito tab stay grouped
              together and size to their own content/cap — the flex-1
              spacer below is what pushes "Nova transação" to the right,
              so the empty space on wide screens lands between the groups
              (list controls vs. primary action) instead of inside the
              search box. `flex-wrap` (only on this inner group, not the
              outer row) is what added the tab without eating into the
              "Nova transação" button's own spot on a narrow screen —
              it drops to a second line here first instead. */}
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={searchText}
              onChange={setSearchText}
              placeholder={t("search.placeholder")}
              clearLabel={t("search.clear")}
              isLoading={isFetching}
            />
            <FiltersSheet
              filters={sheetFilters}
              onChange={setSheetFilters}
              accounts={accounts}
              categories={categories}
              people={people}
              accountKind={accountKind}
            />
            <ToggleGroup
              type="single"
              variant="tabs"
              value={accountKind}
              onValueChange={(value) => {
                if (value) handleAccountKindChange(value as typeof accountKind);
              }}
            >
              <ToggleGroupItem value="debit">
                {t("tabs.accountKind.debit")}
              </ToggleGroupItem>
              <ToggleGroupItem value="credit">
                {t("tabs.accountKind.credit")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                {t("buttons.add.title")}
                <CaretDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() =>
                  setDialogState({ mode: "create", kind: "debit" })
                }>
                {t("buttons.add.debit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  setDialogState({ mode: "create", kind: "credit" })
                }>
                {t("buttons.add.credit")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTransferOpen(true)}>
                {t("buttons.add.transfer")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                {t("buttons.add.import")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {hasChipFilters && (
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(CHIP_FIELD) as (keyof typeof CHIP_FIELD)[]).map(
              (kind) => {
                const label = chipLabel(kind);
                if (!label) return null;
                return (
                  <span
                    key={kind}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs">
                    {label}
                    <button
                      type="button"
                      onClick={() => removeChip(kind)}
                      aria-label={t("filters.chips.remove", { value: label })}
                      className="text-muted-foreground hover:text-foreground">
                      <XIcon className="size-3" />
                    </button>
                  </span>
                );
              },
            )}
            <button
              type="button"
              // Keeps the active Débito/Crédito tab (broadened to "every
              // account of this kind") rather than wiping accountId
              // entirely — same reasoning as removeChip's own "account"
              // case above.
              onClick={() => setSheetFilters({ accountId: accountIdForKind(accountKind) })}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline">
              {t("filters.clearAll")}
            </button>
          </div>
        )}

        {/* DataTable doesn't adapt well below 700px (redesign spec item 6 —
            below that, rows become two-height cards instead of a table);
            both are always mounted, just toggled with Tailwind's
            hidden/block, so server and client render identically and only
            CSS differs. Using `useIsMobile()` here instead would cause a
            hydration mismatch, since the server can't know the viewport
            size. 700px is a one-off cutoff (narrower than Tailwind's `md`
            at 768px) picked for this table specifically, not a shared
            breakpoint token. */}
        <div className="hidden min-[700px]:block">
          <DataTable
            columns={columns}
            data={transactions}
            groupBy="date"
            renderGroupHeader={renderGroupHeader}
            renderSubRows={renderSubRows}
            emptyState={emptyStateNode}
            getRowId={(row) => row.id}
            selection={tableSelection}
          />
        </div>
        <div className="block min-[700px]:hidden">
          <TransactionMobileList
            transactions={transactions}
            formatGroupHeader={formatGroupHeaderParts}
            getDateKey={(row) => dateOnlyKey(row.effectiveDate)}
            formatAmount={(amount) =>
              formatSignedAmount(amount, (value) =>
                format.number(value, { style: "currency", currency: "BRL" }),
              )
            }
            messages={{
              statusLabel: (status) =>
                tCommon(`status.${status.toLowerCase()}`),
              paymentMethodLabel: (method) =>
                t(`fields.paymentMethod.${method}`),
              mobileSubtitle: (category, paymentMethod, person) =>
                t("table.mobileSubtitle", { category, paymentMethod, person }),
              selfLabel: t("table.self"),
              installmentLabel: (number, count) => t("table.installment", { number, count }),
              oneTimePaymentLabel: t("table.oneTimePayment"),
              formatPurchaseDate: (date) => format.dateTime(date, DATE_ONLY_FORMAT_OPTIONS),
              creditCardAccountLabel: t("table.creditCardAccount"),
              markCompletedAria: t("aria.markCompleted"),
              menuAria: t("aria.menu"),
              menuEdit: t("menu.edit"),
              menuDuplicate: t("menu.duplicate"),
              menuDelete: t("menu.delete"),
            }}
            actions={{
              onEdit: handleEditRow,
              onDuplicate: (row) =>
                setDialogState({
                  mode: "create",
                  kind: kindForRow(row),
                  prefillFrom: row,
                }),
              onDelete: (row) => setDeletingTransaction(row),
              onMarkCompleted: handleMarkCompleted,
            }}
            emptyState={emptyStateNode}
          />
        </div>
      </div>

      <SpecialTransactionDialog
        open={specialTransaction !== null}
        onOpenChange={(open) => {
          if (!open) setSpecialTransaction(null);
        }}
        special={specialTransaction}
      />

      <DebitTransactionSheet
        open={dialogState !== null && dialogState.kind === "debit"}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        mode={dialogState?.mode ?? "create"}
        prefill={
          dialogState?.mode === "edit"
            ? dialogState.row
            : (dialogState?.prefillFrom ?? null)
        }
        accounts={selectableDebitAccounts}
        categories={categories}
        people={people}
        defaultPersonId={defaultPersonId}
        defaultAccountId={defaultDebitAccountId}
        onSubmit={handleSubmitDebit}
        onSubmitBatch={handleSubmitBatch}
        onBatchSuccess={handleBatchSuccess}
      />

      <TransferSheet
        open={transferOpen}
        onOpenChange={setTransferOpen}
        // Full list: the form keeps only active checking/savings/cash
        // itself, from the same constant createTransfer checks against.
        accounts={accounts}
        categories={categories}
        people={people}
        defaultAccountId={defaultDebitAccountId}
        onSubmit={handleSubmitTransfer}
      />

      <ImportStatementSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        // The full list, not the two `selectable*` splits: the import
        // offers cards AND accounts in one picker, and drops the
        // archived ones itself (there is no row being edited here whose
        // old account would need to survive the filter).
        accounts={accounts}
        categories={categories}
        people={people}
        defaultPersonId={defaultPersonId}
        onSubmitDebit={handleSubmitBatch}
        onSubmitCredit={handleSubmitCreditBatch}
        onSuccess={(count) => {
          handleBatchSuccess(count);
          setImportOpen(false);
        }}
      />

      <CreditTransactionSheet
        open={dialogState !== null && dialogState.kind === "credit"}
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
        defaultAccountId={defaultCreditAccountId ?? undefined}
        onSubmit={handleSubmitCredit}
        onSubmitBatch={handleSubmitCreditBatch}
        onBatchSuccess={handleBatchSuccess}
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
