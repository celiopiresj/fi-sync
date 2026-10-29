"use client";

import {
  currentPeriod,
  periodRange,
  periodsEqual,
  shiftPeriod,
  type Period,
} from "@/app/[locale]/(app)/transactions/_lib/period";
import { PageHeader, PeriodStepper } from "@/components/screen/page-header";
import { SearchInput } from "@/components/screen/search-input";
import {
  ViewModeToggle,
  type ViewMode,
} from "@/components/screen/view-mode-toggle";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { APP_TIME_ZONE, parseCalendarDate } from "@/lib/date";
import { CaretDownIcon, ChartPieSliceIcon } from "@phosphor-icons/react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ALERT_THRESHOLD_DANGER,
  ALERT_THRESHOLD_WARNING,
} from "../_constants/constants";
import { useBudgetData } from "../_hooks/use-budget-data";
import { useBudgetMutations } from "../_hooks/use-budget-mutations";
import type { BudgetFormValues } from "../_schema/schema";
import type {
  BudgetWithSpending,
  CategoryOption,
  GroupOption,
} from "../_types/types";
import { BudgetGroupSection } from "./budget-group-section";
import { BudgetSheet } from "./form/budget-sheet";
import { CopyPreviousConfirmDialog } from "./form/copy-previous-confirm-dialog";
import { GroupManagerDialog } from "./form/group-manager-dialog";
import { SuggestLimitsConfirmDialog } from "./form/suggest-limits-confirm-dialog";
import { SummaryCards } from "./summary-cards";

type ItemsFilter = "all" | "exceeded" | "within";

type BudgetsViewProps = {
  initialBudget: BudgetWithSpending | null;
  categories: CategoryOption[];
  initialGroups: GroupOption[];
};

export function BudgetsView({
  initialBudget,
  categories,
  initialGroups,
}: BudgetsViewProps) {
  const t = useTranslations("scrn-budgets");
  const format = useFormatter();

  const [initialPeriod] = useState(() => currentPeriod());
  const [period, setPeriod] = useState<Period>(initialPeriod);

  const { from } = useMemo(() => periodRange(period), [period]);
  const monthKey = from.slice(0, 7); // "yyyy-MM"

  const isDefaultFilters = periodsEqual(period, initialPeriod);

  const { budget, invalidate } = useBudgetData(
    monthKey,
    initialBudget,
    isDefaultFilters,
  );

  const mutations = useBudgetMutations(invalidate);

  // Local groups state — will be refreshed from form options on mutations
  const [groups, setGroups] = useState<GroupOption[]>(initialGroups);

  // Sheet/dialog state
  const [sheetState, setSheetState] = useState<{
    open: boolean;
    mode: "create" | "edit";
  }>({ open: false, mode: "create" });
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  // Only ever opened from the "Editar" menu's own "Copiar do mês
  // anterior" item below — that's the one path where a budget already
  // exists for the current month, so copying over it is destructive
  // (replaces every current limit) and needs confirmation first. The
  // empty-state's own copy shortcut has nothing to overwrite and skips
  // this.
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);
  // Only ever opened from the empty state's own "Sugerir com base nos
  // últimos N meses" button — nothing to overwrite there (mode is always
  // effectively "create"), so this is a plain "do you want this?"
  // confirmation, not a destructive one like copyConfirmOpen above.
  const [suggestConfirmOpen, setSuggestConfirmOpen] = useState(false);

  // Toolbar state — search/status filter narrow which items render below;
  // viewMode (default "cards") picks BudgetGroupSection's item layout.
  const [searchText, setSearchText] = useState("");
  const [itemsFilter, setItemsFilter] = useState<ItemsFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  // Format the period label for the stepper
  const periodStartDate = useMemo(() => parseCalendarDate(from), [from]);
  const periodStepperLabel = format.dateTime(periodStartDate, {
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  });
  const periodMonthNameLong = format.dateTime(periodStartDate, {
    month: "long",
    timeZone: APP_TIME_ZONE,
  });

  // Only feeds BudgetSheet's "create" mode copy-shortcut button — its
  // own copyBudgetFromPreviousMonth (handleCopyFromPrevious below)
  // resolves which month is "previous" server-side from `monthKey`
  // itself, so this is display-only.
  const previousPeriodStartDate = useMemo(
    () => parseCalendarDate(periodRange(shiftPeriod(period, -1)).from),
    [period],
  );
  const previousMonthLabel = format.dateTime(previousPeriodStartDate, {
    month: "long",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  });

  // Alert toasts on page load — only fire once per budget load
  const alertedBudgetId = useRef<string | null>(null);
  useEffect(() => {
    if (!budget || budget.id === alertedBudgetId.current) return;
    alertedBudgetId.current = budget.id;

    const over100 = budget.items.filter(
      (item) => item.percentage >= ALERT_THRESHOLD_DANGER,
    );
    const over80 = budget.items.filter(
      (item) =>
        item.percentage >= ALERT_THRESHOLD_WARNING &&
        item.percentage < ALERT_THRESHOLD_DANGER,
    );

    if (over100.length > 0) {
      toast.error(t("toast.alert100", { count: over100.length }));
    }
    if (over80.length > 0) {
      toast.warning(t("toast.alert80", { count: over80.length }));
    }
  }, [budget, t]);

  // Search (category/group name) + status filter — applied before
  // grouping, so a group with no matching items just doesn't render below
  // (rather than rendering empty).
  const filteredItems = useMemo(() => {
    if (!budget) return [];
    const query = searchText.trim().toLowerCase();

    return budget.items.filter((item) => {
      const isExceeded = item.spent > item.limit;
      const matchesFilter =
        itemsFilter === "all" ||
        (itemsFilter === "exceeded" && isExceeded) ||
        (itemsFilter === "within" && !isExceeded);
      if (!matchesFilter) return false;
      if (!query) return true;
      return (
        matchesSearch(item.category.name, query) || matchesSearch(item.group?.name ?? "", query)
      );
    });
  }, [budget, searchText, itemsFilter]);

  // Group the filtered items by their group (or "ungrouped")
  const groupedItems = useMemo(() => {
    const groupMap = new Map<
      string,
      { name: string; sortOrder: number; items: typeof filteredItems }
    >();

    for (const item of filteredItems) {
      const key = item.groupId ?? "__ungrouped__";
      const existing = groupMap.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        groupMap.set(key, {
          name: item.group?.name ?? t("group.ungrouped"),
          sortOrder: item.group?.sortOrder ?? Number.MAX_SAFE_INTEGER,
          items: [item],
        });
      }
    }

    return [...groupMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [filteredItems, t]);

  const hasNoSearchResults =
    budget !== null && budget.items.length > 0 && filteredItems.length === 0;

  // Budget form handlers
  async function handleCreateBudget(values: BudgetFormValues) {
    const result = await mutations.createBudget(monthKey, values);
    if (!result.error) {
      toast.success(t("toast.created"));
    }
  }

  async function handleUpdateBudget(values: BudgetFormValues) {
    if (!budget) return;
    const result = await mutations.updateBudget(budget.id, values);
    if (!result.error) {
      toast.success(t("toast.updated"));
    }
  }

  async function handleCopyFromPrevious() {
    const result = await mutations.copyFromPrevious(monthKey);
    if (result.error === "no_previous") {
      toast.error(t("errors.noPreviousBudget.title"), {
        description: t("errors.noPreviousBudget.description"),
      });
    } else if (!result.error) {
      toast.success(t("toast.copied"));
    }
    return result;
  }

  async function handleConfirmCopyFromPrevious() {
    const result = await handleCopyFromPrevious();
    if (!result.error) setCopyConfirmOpen(false);
  }

  // Suggests each category's own limit from its average spend over the
  // last SUGGESTION_MONTHS_COUNT months, then creates the current
  // month's budget from those straight away (same "apply now, adjust
  // later" flow as handleCopyFromPrevious above — expectedIncome starts
  // at 0 since suggestBudgetLimits only ever averages EXPENSE history,
  // there's no income figure to suggest here). Only reachable from the
  // empty state (no budget for this month yet), so unlike copying there
  // is nothing to overwrite and nothing to confirm beyond "yes, do this."
  async function handleConfirmSuggestLimits() {
    const suggestResult = await mutations.suggestLimits();
    if (suggestResult.error === "no_history") {
      toast.error(t("errors.noTransactionHistory.title"), {
        description: t("errors.noTransactionHistory.description"),
      });
      return;
    }
    if (suggestResult.error || !suggestResult.suggestions) return;

    const createResult = await mutations.createBudget(monthKey, {
      expectedIncome: "0",
      items: suggestResult.suggestions.map((suggestion) => ({
        categoryId: suggestion.categoryId,
        limit: String(suggestion.averageSpent),
      })),
    });
    if (!createResult.error) {
      toast.success(t("toast.suggested"));
      setSuggestConfirmOpen(false);
    }
  }

  // Group CRUD handlers. handleCreateGroup returns the result (not just
  // void) so BudgetForm's own inline "new group" prompt — reached from
  // the per-item group picker, not just this screen's "Manage Groups"
  // dialog — can select the freshly created group for whichever item
  // triggered it.
  async function handleCreateGroup(name: string) {
    const result = await mutations.createGroup({ name });
    if (!result.error) {
      toast.success(t("toast.groupCreated"));
      if (result.id) {
        setGroups((prev) => [
          ...prev,
          { id: result.id!, name, sortOrder: prev.length },
        ]);
      }
    }
    return result;
  }

  async function handleUpdateGroup(groupId: string, name: string) {
    const result = await mutations.updateGroup(groupId, { name });
    if (!result.error) {
      toast.success(t("toast.groupUpdated"));
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, name } : g)),
      );
    }
  }

  async function handleDeleteGroup(groupId: string) {
    const result = await mutations.deleteGroup(groupId);
    if (!result.error) {
      toast.success(t("toast.groupDeleted"));
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    }
  }

  const itemCount = budget?.items.length ?? 0;

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      {/* Header with period stepper */}
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", {
          month: periodMonthNameLong,
          count: itemCount,
        })}
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

      {/* Content: empty state or budget data */}
      {!budget ? (
        <Empty className="border-none py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ChartPieSliceIcon />
            </EmptyMedia>
            <EmptyTitle>
              {t("empty.title", { month: periodMonthNameLong })}
            </EmptyTitle>
            <EmptyDescription>{t("empty.description")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                size="sm"
                onClick={() => setSheetState({ open: true, mode: "create" })}>
                {t("empty.createFromScratch")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSuggestConfirmOpen(true)}
                disabled={mutations.isPending}>
                {t("empty.createFromAverage")}
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          {/* Summary cards */}
          <SummaryCards budget={budget} />

          {/* Toolbar: search + status filter (left), view toggle + edit menu (right) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              value={searchText}
              onChange={setSearchText}
              placeholder={t("search.placeholder")}
              clearLabel={t("search.clear")}
            />

            <div className="flex items-center gap-2">
              <ToggleGroup
                type="single"
                variant="tabs"
                size="sm"
                value={itemsFilter}
                onValueChange={(value) => {
                  if (value) setItemsFilter(value as ItemsFilter);
                }}>
                <ToggleGroupItem value="all">
                  {t("filters.tabs.all")}
                </ToggleGroupItem>
                <ToggleGroupItem value="exceeded">
                  {t("filters.tabs.exceeded")}
                </ToggleGroupItem>
                <ToggleGroupItem value="within">
                  {t("filters.tabs.within")}
                </ToggleGroupItem>
              </ToggleGroup>
              <ViewModeToggle
                value={viewMode}
                onValueChange={setViewMode}
                cardsLabel={t("filters.viewMode.cards")}
                listLabel={t("filters.viewMode.list")}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {t("buttons.edit")}
                    <CaretDownIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() =>
                      setSheetState({ open: true, mode: "edit" })
                    }>
                    {t("buttons.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setCopyConfirmOpen(true)}>
                    {t("buttons.copyPrevious")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setGroupDialogOpen(true)}>
                    {t("buttons.manageGroups")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Grouped items list, or a distinct empty state when the
              search/filter combination matches nothing */}
          {hasNoSearchResults ? (
            <Empty className="border-none py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ChartPieSliceIcon />
                </EmptyMedia>
                <EmptyTitle>{t("search.empty.title")}</EmptyTitle>
                <EmptyDescription>
                  {t("search.empty.description")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-6">
              {groupedItems.map((group) => (
                <BudgetGroupSection
                  key={group.name}
                  name={group.name}
                  items={group.items}
                  viewMode={viewMode}
                  onEditItem={() => setSheetState({ open: true, mode: "edit" })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Budget create/edit sheet */}
      <BudgetSheet
        open={sheetState.open}
        onOpenChange={(open) => setSheetState((prev) => ({ ...prev, open }))}
        mode={sheetState.mode}
        monthLabel={periodMonthNameLong}
        previousMonthLabel={previousMonthLabel}
        onCopyFromPrevious={handleCopyFromPrevious}
        isCopyPending={mutations.isPending}
        categories={categories}
        groups={groups}
        budget={budget}
        onSubmit={
          sheetState.mode === "create" ? handleCreateBudget : handleUpdateBudget
        }
        isPending={mutations.isPending}
        onCreateGroup={handleCreateGroup}
      />

      {/* Copy-from-previous-month overwrite confirmation */}
      <CopyPreviousConfirmDialog
        open={copyConfirmOpen}
        onOpenChange={setCopyConfirmOpen}
        onConfirm={handleConfirmCopyFromPrevious}
        isPending={mutations.isPending}
        previousMonthLabel={previousMonthLabel}
        currentMonthLabel={periodMonthNameLong}
      />

      {/* Suggest-limits-from-history confirmation */}
      <SuggestLimitsConfirmDialog
        open={suggestConfirmOpen}
        onOpenChange={setSuggestConfirmOpen}
        onConfirm={handleConfirmSuggestLimits}
        isPending={mutations.isPending}
      />

      {/* Group manager dialog */}
      <GroupManagerDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        groups={groups}
        onCreateGroup={async (name) => {
          await handleCreateGroup(name);
        }}
        onUpdateGroup={handleUpdateGroup}
        onDeleteGroup={handleDeleteGroup}
        isPending={mutations.isGroupPending}
      />
    </div>
  );
}
