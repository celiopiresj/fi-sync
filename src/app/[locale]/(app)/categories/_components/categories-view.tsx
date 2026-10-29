"use client";

import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import { PageHeader } from "@/components/screen/page-header";
import { SearchInput } from "@/components/screen/search-input";
import {
  ViewModeToggle,
  type ViewMode,
} from "@/components/screen/view-mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { matchesSearch } from "@/lib/normalize-search";
import { cn } from "@/lib/utils";
import {
  CreditCardIcon,
  HandCoinsIcon,
  PiggyBankIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { createElement, useMemo, useState, type ReactNode } from "react";
import { useCategoryMutations } from "../_hooks/use-category-mutations";
import type { CategoryRow } from "../_types/types";
import { DeleteDialog } from "./delete-dialog";
import { CategorySheet } from "./form/category-sheet";

type CategoriesViewProps = {
  data: CategoryRow[];
};

type FilterType =
  | "all"
  | "EXPENSE"
  | "INCOME"
  | "INVESTMENT"
  | "LOAN"
  | "CARD_PAYMENT";

// Same tone map as category-selectors.tsx (kept local to each file rather
// than shared, since neither imports from the other) — expense/income map
// onto the app's negative/positive money tokens, investment reuses warning
// as a third distinct tone, loan and card payment both reuse negative
// (both are plain expenses — see prisma/schema.prisma's
// CategoryType.LOAN/CARD_PAYMENT comments).
const TYPE_TEXT: Record<Exclude<FilterType, "all">, string> = {
  EXPENSE: "text-negative",
  INCOME: "text-positive",
  INVESTMENT: "text-warning",
  LOAN: "text-negative",
  CARD_PAYMENT: "text-negative",
};

const TYPE_ICON: Record<Exclude<FilterType, "all">, ReactNode> = {
  EXPENSE: <TrendDownIcon className="size-3" />,
  INCOME: <TrendUpIcon className="size-3" />,
  INVESTMENT: <PiggyBankIcon className="size-3" />,
  LOAN: <HandCoinsIcon className="size-3" />,
  CARD_PAYMENT: <CreditCardIcon className="size-3" />,
};

export function CategoriesView({ data }: CategoriesViewProps) {
  const t = useTranslations("scrn-categories");
  const mutations = useCategoryMutations();

  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const [dialogState, setDialogState] = useState<{
    mode: "create" | "edit";
    row?: CategoryRow;
  } | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryRow | null>(
    null,
  );

  const filteredData = useMemo(() => {
    return data.filter((cat) => {
      const catType = cat.type || "EXPENSE";
      const matchesType = filterType === "all" || catType === filterType;
      const matchesSearchFilter = matchesSearch(cat.name || "", searchQuery);
      return matchesType && matchesSearchFilter;
    });
  }, [data, filterType, searchQuery]);

  const kpis = useMemo(() => {
    return {
      total: data.length,
      expenses: data.filter((c) => (c.type || "EXPENSE") === "EXPENSE").length,
      incomes: data.filter((c) => c.type === "INCOME").length,
      investments: data.filter((c) => c.type === "INVESTMENT").length,
    };
  }, [data]);

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        badge={
          <Badge variant="secondary">
            {t("counts", { count: data.length })}
          </Badge>
        }
        right={
          <Button onClick={() => setDialogState({ mode: "create" })}>
            <PlusIcon />
            {t("buttons.add")}
          </Button>
        }
      />

      <KpiGrid>
        <KpiCard
          label={t("kpi.total.title")}
          value={kpis.total}
          subtitle={t("kpi.total.description")}
          icon={<TagIcon className="size-5" />}
        />
        <KpiCard
          label={t("kpi.expenses.title")}
          value={kpis.expenses}
          tone="negative"
          subtitle={t("kpi.expenses.description")}
          icon={<TrendDownIcon className="size-5" />}
        />
        <KpiCard
          label={t("kpi.incomes.title")}
          value={kpis.incomes}
          tone="positive"
          subtitle={t("kpi.incomes.description")}
          icon={<TrendUpIcon className="size-5" />}
        />
        <KpiCard
          label={t("kpi.investments.title")}
          value={kpis.investments}
          tone="warning"
          subtitle={t("kpi.investments.description")}
          icon={<PiggyBankIcon className="size-5" />}
        />
      </KpiGrid>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("filters.searchPlaceholder")}
          clearLabel={t("filters.clearSearch")}
        />
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            variant="tabs"
            size="sm"
            value={filterType}
            onValueChange={(value) => {
              if (value) setFilterType(value as FilterType);
            }}>
            <ToggleGroupItem value="all">{t("filters.all")}</ToggleGroupItem>
            <ToggleGroupItem value="EXPENSE">
              {t("filters.expense")}
            </ToggleGroupItem>
            <ToggleGroupItem value="INCOME">
              {t("filters.income")}
            </ToggleGroupItem>
            <ToggleGroupItem value="INVESTMENT">
              {t("filters.investment")}
            </ToggleGroupItem>
            <ToggleGroupItem value="LOAN">
              {t("filters.loan")}
            </ToggleGroupItem>
            <ToggleGroupItem value="CARD_PAYMENT">
              {t("filters.cardPayment")}
            </ToggleGroupItem>
          </ToggleGroup>

          <ViewModeToggle
            value={viewMode}
            onValueChange={setViewMode}
            cardsLabel={t("filters.viewMode.cards")}
            listLabel={t("filters.viewMode.list")}
          />
        </div>
      </div>

      {/* Content */}
      {filteredData.length === 0 ? (
        <Empty className="border-none py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TagIcon />
            </EmptyMedia>
            <EmptyTitle>{t("table.empty.title")}</EmptyTitle>
            <EmptyDescription>{t("table.empty.description")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredData.map((cat) => {
            const isSystem = cat.userId === null;
            const catType = (cat.type || "EXPENSE") as Exclude<
              FilterType,
              "all"
            >;
            return (
              <Card
                key={cat.id}
                radius="lg"
                className="flex-row items-center justify-between gap-3 px-4 py-3 transition-shadow hover:shadow-md"
                onClick={() => {
                  if (!isSystem) setDialogState({ mode: "edit", row: cat });
                }}>
                <div
                  className={cn(
                    "flex min-w-0 items-center gap-3",
                    !isSystem && "cursor-pointer",
                  )}>
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg font-bold",
                      cat.colorStyle || "bg-muted text-muted-foreground",
                    )}>
                    {createElement(resolveCategoryIcon(cat.icon), {
                      className: "size-5",
                    })}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-xs font-bold">{cat.name}</h3>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs font-semibold",
                        TYPE_TEXT[catType],
                      )}>
                      {TYPE_ICON[catType]}
                      {t(`fields.type.${catType.toLowerCase()}`)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant={isSystem ? "secondary" : "outline"}>
                    {t(`table.origin.${isSystem ? "system" : "custom"}`)}
                  </Badge>
                  {!isSystem && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingCategory(cat);
                      }}
                      aria-label={t("buttons.delete")}>
                      <TrashIcon />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.columns.name")}</TableHead>
                <TableHead>{t("table.columns.type")}</TableHead>
                <TableHead>{t("table.columns.origin")}</TableHead>
                <TableHead className="text-right">
                  {t("table.columns.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((cat) => {
                const isSystem = cat.userId === null;
                const catType = (cat.type || "EXPENSE") as Exclude<
                  FilterType,
                  "all"
                >;
                return (
                  <TableRow key={cat.id}>
                    <TableCell
                      className={cn(
                        "font-semibold",
                        !isSystem && "cursor-pointer",
                      )}
                      onClick={() => {
                        if (!isSystem)
                          setDialogState({ mode: "edit", row: cat });
                      }}>
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg",
                            cat.colorStyle || "bg-muted text-muted-foreground",
                          )}>
                          {createElement(resolveCategoryIcon(cat.icon), {
                            className: "size-4",
                          })}
                        </div>
                        <span>{cat.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "flex items-center gap-1 text-xs font-semibold",
                          TYPE_TEXT[catType],
                        )}>
                        {TYPE_ICON[catType]}
                        {t(`fields.type.${catType.toLowerCase()}`)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isSystem ? "secondary" : "outline"}>
                        {t(`table.origin.${isSystem ? "system" : "custom"}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!isSystem ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeletingCategory(cat)}
                          aria-label={t("buttons.delete")}>
                          <TrashIcon />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {dialogState && (
        <CategorySheet
          open={true}
          onOpenChange={(open) => {
            if (!open) setDialogState(null);
          }}
          mode={dialogState.mode}
          prefill={dialogState.row ?? null}
          onSubmit={async (values) => {
            if (dialogState.mode === "edit" && dialogState.row) {
              return await mutations.update.mutateAsync({
                id: dialogState.row.id,
                data: values,
              });
            }
            return await mutations.create.mutateAsync(values);
          }}
        />
      )}

      {deletingCategory && (
        <DeleteDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setDeletingCategory(null);
          }}
          onConfirm={async () => {
            await mutations.remove.mutateAsync(deletingCategory.id);
            setDeletingCategory(null);
          }}
          isPending={mutations.remove.isPending}
        />
      )}
    </div>
  );
}
