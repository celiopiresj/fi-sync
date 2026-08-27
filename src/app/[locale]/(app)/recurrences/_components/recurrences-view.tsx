"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { toast } from "sonner";
import {
  ArrowsClockwiseIcon,
  CaretDownIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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
import { PageHeader } from "@/components/screen/page-header";
import { SearchInput } from "@/components/screen/search-input";
import type { Column } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { renderSplitSubRows } from "@/components/data-table/split-sub-rows";
import { formatPersonName } from "@/lib/format-person-name";
import { SummaryCards } from "./summary-cards";
import { RecurrenceMobileList } from "./table/recurrence-mobile-list";
import { FiltersSheet } from "./table/filters-sheet";
import { DebitRecurrenceSheet } from "./form/debit-recurrence-sheet";
import { CreditRecurrenceSheet } from "./form/credit-recurrence-sheet";
import { DeleteDialog } from "./delete-dialog";
import { getRecurrenceColumns } from "./table/columns";
import {
  createDebitRecurrence,
  updateDebitRecurrence,
  createCreditRecurrence,
  updateCreditRecurrence,
  deleteRecurrence,
  extendRecurrenceGeneration,
  type RecurrenceFilters,
} from "../actions";
import { useRecurrencesData } from "../_hooks/use-recurrences-data";
import { useRecurrenceFormOptions } from "../_hooks/use-recurrence-form-options";
import { DATE_ONLY_FORMAT_OPTIONS } from "@/lib/date";
import { formatSignedAmount } from "../_lib/format-signed-amount";
import type {
  DebitRecurrenceContentFormValues,
  DebitRecurrenceCreateFormValues,
  CreditRecurrenceContentFormValues,
  CreditRecurrenceCreateFormValues,
  RecurrenceSheetFilters,
} from "../_schema/schema";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
  RecurrenceRow,
} from "../_types/types";

// `kind` picks which sheet renders (DebitRecurrenceSheet vs
// CreditRecurrenceSheet — same split as transactions-view.tsx's own
// TransactionKind) — chosen explicitly from the "Nova recorrência"
// dropdown on create, and derived from the row's own account type (see
// kindForRow below) on edit, so editing always reopens the form the row
// actually belongs to.
type RecurrenceKind = "debit" | "credit";

type DialogState =
  | { mode: "create"; kind: RecurrenceKind }
  | { mode: "edit"; kind: RecurrenceKind; row: RecurrenceRow }
  | null;

function kindForRow(row: RecurrenceRow): RecurrenceKind {
  return row.account.type === "CREDIT_CARD" ? "credit" : "debit";
}

type RecurrencesViewProps = {
  initialRecurrences: RecurrenceRow[];
  accounts: AccountOption[];
  categories: CategoryOption[];
  initialPeople: PersonOption[];
  initialDefaultPersonId: string | null;
};

// Maps a chip's kind to the RecurrenceSheetFilters key it clears — same
// role as transactions-view.tsx's own CHIP_FIELD, plus "status" (this
// screen's own extra filter, see the RecurrenceSheetFilters comment in
// _schema/schema.ts).
const CHIP_FIELD = {
  account: "accountId",
  category: "categoryId",
  type: "type",
  status: "status",
} as const;

// True when `value` has no filter actually applied — checks each field's
// truthiness rather than key presence, same reasoning as transactions-
// view.tsx's hasActiveSheetFilters (FiltersSheet's Selects clear a filter
// by setting it to `undefined`, not by removing the key). "status" only
// counts once it differs from the screen's own default ("active").
function hasActiveSheetFilters(value: RecurrenceSheetFilters): boolean {
  return Boolean(
    value.accountId ||
      value.categoryId ||
      (value.type && value.type !== "all") ||
      (value.status && value.status !== "active"),
  );
}

export function RecurrencesView({
  initialRecurrences,
  accounts,
  categories,
  initialPeople,
  initialDefaultPersonId,
}: RecurrencesViewProps) {
  const t = useTranslations("scrn-recurrences");
  const format = useFormatter();

  // Search lives outside FiltersSheet (same split as transactions-view.tsx)
  // so "Limpar filtros" inside the sheet can't wipe out text the user typed
  // directly into the header search box.
  const [sheetFilters, setSheetFilters] = useState<RecurrenceSheetFilters>({});
  const [searchText, setSearchText] = useState("");

  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [deletingRecurrence, setDeletingRecurrence] = useState<RecurrenceRow | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  // Which recurrence(s) currently have a "gerar mais" call in flight —
  // a Set (not a single id) since nothing prevents extending two
  // different rows back to back before the first finishes.
  const [extendingIds, setExtendingIds] = useState<Set<string>>(new Set());

  const filters: RecurrenceFilters = useMemo(
    () => ({ ...sheetFilters, search: searchText.trim() || undefined }),
    [sheetFilters, searchText],
  );

  // page.tsx fetches exactly this default (no filters, no search) for
  // `initialRecurrences` — mirrors transactions-view.tsx's isDefaultFilters,
  // just without a period to also compare.
  const isDefaultFilters = !hasActiveSheetFilters(sheetFilters) && searchText === "";

  const { recurrences, invalidate } = useRecurrencesData(
    filters,
    initialRecurrences,
    isDefaultFilters,
  );

  // accounts/categories come straight from page.tsx's server-rendered
  // props, same as transactions-view.tsx's own `accounts`/`categories` —
  // no live query for either here, since nothing on this screen creates
  // an account or category inline; there's nothing that would ever make
  // them go stale mid-session. `people` DOES get a live query, same as
  // transactions, since the recurrence form's own "Cadastrar nova
  // pessoa" flow (person/splits section, tasks/012) can create one
  // inline mid-session.
  const { people, defaultPersonId } = useRecurrenceFormOptions(
    initialPeople,
    initialDefaultPersonId,
  );

  // Split by account type (same reasoning as transactions-view.tsx's own
  // selectableDebitAccounts/selectableCreditAccounts) — debit and credit
  // are separate forms with separate account pickers, so each only ever
  // sees the subset of accounts it actually applies to.
  const selectableDebitAccounts = useMemo(
    () => accounts.filter((account) => account.type !== "CREDIT_CARD"),
    [accounts],
  );
  const selectableCreditAccounts = useMemo(
    () => accounts.filter((account) => account.type === "CREDIT_CARD"),
    [accounts],
  );

  const frequencyLabel = useCallback(
    (frequency: RecurrenceRow["frequency"]) => t(`table.frequency.${frequency}`),
    [t],
  );

  const formatAmount = useCallback(
    (amount: number) =>
      formatSignedAmount(amount, (value) =>
        format.number(value, { style: "currency", currency: "BRL" }),
      ),
    [format],
  );

  // start/end are @db.Date columns read back from listRecurrences (Prisma
  // returns UTC midnight for that calendar day) — DATE_ONLY_FORMAT_OPTIONS
  // (UTC) is the correct formatter here, same as RecurrenceEditForm's own
  // scheduleSummary. Never APP_TIME_ZONE or a bare next-intl default for
  // these two — see lib/date.ts's file-level comment on the three date
  // cases this app has to tell apart.
  const formatDuration = useCallback(
    (start: Date, end: Date | null) => {
      const startLabel = format.dateTime(start, DATE_ONLY_FORMAT_OPTIONS);
      if (!end) return t("table.duration.openEnded", { start: startLabel });
      return t("table.duration.range", {
        start: startLabel,
        end: format.dateTime(end, DATE_ONLY_FORMAT_OPTIONS),
      });
    },
    [t, format],
  );

  // Resolves the "gerar mais" affordance columns.tsx/recurrence-mobile-
  // list.tsx render wherever listRecurrences flagged needsExtension —
  // generates the rule's next window from its own stored template (see
  // extendRecurrenceGeneration in actions.ts), no form involved. Tracked
  // per-id (not a single boolean) so extending one row's button doesn't
  // disable every other row's. Both are useCallback'd (matching
  // transactions-view.tsx's own handleBulkCategorize/
  // handleBulkStatusChange) — and declared here, ABOVE `columns`, since
  // that memo's factory closes over both synchronously on every render;
  // referencing a `const` declared later in the same component body
  // would hit the temporal dead zone the moment `columns` itself first
  // renders, not just a lint nitpick.
  const isExtending = useCallback(
    (id: string) => extendingIds.has(id),
    [extendingIds],
  );

  const handleExtend = useCallback(
    async (row: RecurrenceRow) => {
      setExtendingIds((current) => new Set(current).add(row.id));
      const result = await extendRecurrenceGeneration(row.id);
      setExtendingIds((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
      if (!result.error) {
        invalidate();
        if (result.generatedCount) {
          toast.success(t("toast.extended", { count: result.generatedCount }));
        }
      } else {
        toast.error(result.error);
      }
    },
    [invalidate, t],
  );

  function renderSubRows(row: RecurrenceRow, columns: Column<RecurrenceRow, unknown>[]) {
    return renderSplitSubRows(
      row.splits.map((split) => ({
        key: split.personId,
        personName: formatPersonName(split.person.name),
        amount: split.amount,
      })),
      columns,
      formatAmount,
    );
  }

  const columns = useMemo(
    () =>
      getRecurrenceColumns(
        {
          columns: {
            description: t("table.columns.description"),
            account: t("table.columns.account"),
            category: t("table.columns.category"),
            frequency: t("table.columns.frequency"),
            duration: t("table.columns.duration"),
            amount: t("table.columns.amount"),
            person: t("table.columns.person"),
          },
          noCategory: t("table.noCategory"),
          frequencyLabel,
          finishedLabel: t("table.finishedBadge"),
          splitPillLabel: (count) => t("table.splitPill", { count }),
          extendLabel: t("table.extend.label"),
          extendingLabel: t("table.extend.pending"),
          creditCardAccountLabel: t("table.creditCardAccount"),
          menuAria: t("menu.aria"),
          menuEdit: t("menu.edit"),
          menuDelete: t("menu.delete"),
        },
        formatAmount,
        formatDuration,
        {
          onEdit: (row) => setDialogState({ mode: "edit", kind: kindForRow(row), row }),
          onDelete: (row) => setDeletingRecurrence(row),
          onExtend: handleExtend,
          isExtending,
        },
      ),
    [t, frequencyLabel, formatAmount, formatDuration, handleExtend, isExtending],
  );

  async function handleSubmitCreateDebit(
    values: DebitRecurrenceCreateFormValues,
  ): Promise<{ error: string | null }> {
    const result = await createDebitRecurrence(values);
    if (!result.error) {
      invalidate();
      toast.success(t("toast.created"));
    }
    return result;
  }

  async function handleSubmitEditDebit(
    values: DebitRecurrenceContentFormValues,
  ): Promise<{ error: string | null; updatedCount?: number }> {
    if (dialogState?.mode !== "edit") {
      return { error: "Not found" };
    }
    const result = await updateDebitRecurrence(dialogState.row.id, values);
    if (!result.error) {
      invalidate();
      // The ICU plural itself already collapses the count=0 case down to
      // a plain "Recorrência atualizada" — no separate branch needed for
      // "nothing cascaded" vs. "N occurrences also updated".
      toast.success(t("toast.updatedCascade", { count: result.updatedCount ?? 0 }));
    }
    return result;
  }

  async function handleSubmitCreateCredit(
    values: CreditRecurrenceCreateFormValues,
  ): Promise<{ error: string | null }> {
    const result = await createCreditRecurrence(values);
    if (!result.error) {
      invalidate();
      toast.success(t("toast.created"));
    }
    return result;
  }

  async function handleSubmitEditCredit(
    values: CreditRecurrenceContentFormValues,
  ): Promise<{ error: string | null; updatedCount?: number }> {
    if (dialogState?.mode !== "edit") {
      return { error: "Not found" };
    }
    const result = await updateCreditRecurrence(dialogState.row.id, values);
    if (!result.error) {
      invalidate();
      toast.success(t("toast.updatedCascade", { count: result.updatedCount ?? 0 }));
    }
    return result;
  }

  async function handleDeleteConfirm() {
    if (!deletingRecurrence) return;
    setIsDeleting(true);
    await deleteRecurrence(deletingRecurrence.id);
    setIsDeleting(false);
    setDeletingRecurrence(null);
    invalidate();
    toast.success(t("toast.deleted"));
  }

  const headerSubtitle = t("header.subtitle", { count: recurrences.length });

  const hasChipFilters = hasActiveSheetFilters(sheetFilters);

  function chipLabel(kind: keyof typeof CHIP_FIELD): string | null {
    if (kind === "account" && sheetFilters.accountId) {
      const name =
        accounts.find((account) => account.id === sheetFilters.accountId)?.name ??
        "";
      return t("filters.chips.account", { value: name });
    }
    if (kind === "category" && sheetFilters.categoryId) {
      const name =
        categories.find((category) => category.id === sheetFilters.categoryId)
          ?.name ?? "";
      return t("filters.chips.category", { value: name });
    }
    if (kind === "type" && sheetFilters.type && sheetFilters.type !== "all") {
      return t("filters.chips.type", { value: t(`tabs.${sheetFilters.type}`) });
    }
    if (kind === "status" && sheetFilters.status && sheetFilters.status !== "active") {
      return t("filters.chips.status", { value: t(`status.${sheetFilters.status}`) });
    }
    return null;
  }

  function removeChip(kind: keyof typeof CHIP_FIELD) {
    setSheetFilters((current) => {
      const next = { ...current };
      if (kind === "account") delete next.accountId;
      if (kind === "category") delete next.categoryId;
      if (kind === "type") delete next.type;
      if (kind === "status") delete next.status;
      return next;
    });
  }

  const emptyStateNode = (
    <Empty className="border-none py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ArrowsClockwiseIcon />
        </EmptyMedia>
        <EmptyTitle>{t("table.empty.title")}</EmptyTitle>
        <EmptyDescription>{t("table.empty.description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" onClick={() => setDialogState({ mode: "create", kind: "debit" })}>
          {t("table.empty.button")}
        </Button>
      </EmptyContent>
    </Empty>
  );

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader title={t("title")} subtitle={headerSubtitle} />

      <SummaryCards recurrences={recurrences} />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <SearchInput
              value={searchText}
              onChange={setSearchText}
              placeholder={t("search.placeholder")}
              clearLabel={t("search.clear")}
            />
            <FiltersSheet
              filters={sheetFilters}
              onChange={setSheetFilters}
              accounts={accounts}
              categories={categories}
            />
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
                onSelect={() => setDialogState({ mode: "create", kind: "debit" })}
              >
                {t("buttons.add.debit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setDialogState({ mode: "create", kind: "credit" })}
              >
                {t("buttons.add.credit")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {hasChipFilters && (
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(CHIP_FIELD) as (keyof typeof CHIP_FIELD)[]).map((kind) => {
              const label = chipLabel(kind);
              if (!label) return null;
              return (
                <span
                  key={kind}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => removeChip(kind)}
                    aria-label={t("filters.chips.remove", { value: label })}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="size-3" />
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              onClick={() => setSheetFilters({})}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {t("filters.clearAll")}
            </button>
          </div>
        )}

        {/* Same 700px responsive split as transactions-view.tsx (redesign
            spec item 6 / tasks/012.md's "seguir estritamente o padrão") —
            both are always mounted, just toggled with Tailwind hidden/block,
            so server and client render identically and only CSS differs. */}
        <div className="hidden min-[700px]:block">
          <DataTable
            columns={columns}
            data={recurrences}
            renderSubRows={renderSubRows}
            emptyState={emptyStateNode}
            getRowId={(row) => row.id}
          />
        </div>
        <div className="block min-[700px]:hidden">
          <RecurrenceMobileList
            recurrences={recurrences}
            formatAmount={formatAmount}
            messages={{
              frequencyLabel,
              noCategory: t("table.noCategory"),
              finishedBadge: t("table.finishedBadge"),
              cardSubtitle: (account, frequency, person) =>
                t("table.cardSubtitle", { account, frequency, person }),
              extendLabel: t("table.extend.label"),
              extendingLabel: t("table.extend.pending"),
              creditCardAccountLabel: t("table.creditCardAccount"),
              menuAria: t("menu.aria"),
              menuEdit: t("menu.edit"),
              menuDelete: t("menu.delete"),
            }}
            actions={{
              onEdit: (row) => setDialogState({ mode: "edit", kind: kindForRow(row), row }),
              onDelete: (row) => setDeletingRecurrence(row),
              onExtend: handleExtend,
              isExtending,
            }}
            emptyState={emptyStateNode}
          />
        </div>
      </div>

      <DebitRecurrenceSheet
        open={dialogState !== null && dialogState.kind === "debit"}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        mode={dialogState?.mode ?? "create"}
        editingRow={dialogState?.mode === "edit" ? dialogState.row : null}
        accounts={selectableDebitAccounts}
        categories={categories}
        people={people}
        defaultPersonId={defaultPersonId}
        onSubmitCreate={handleSubmitCreateDebit}
        onSubmitEdit={handleSubmitEditDebit}
      />

      <CreditRecurrenceSheet
        open={dialogState !== null && dialogState.kind === "credit"}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        mode={dialogState?.mode ?? "create"}
        editingRow={dialogState?.mode === "edit" ? dialogState.row : null}
        accounts={selectableCreditAccounts}
        categories={categories}
        people={people}
        defaultPersonId={defaultPersonId}
        onSubmitCreate={handleSubmitCreateCredit}
        onSubmitEdit={handleSubmitEditCredit}
      />

      <DeleteDialog
        open={deletingRecurrence !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingRecurrence(null);
        }}
        onConfirm={handleDeleteConfirm}
        isPending={isDeleting}
      />
    </div>
  );
}
