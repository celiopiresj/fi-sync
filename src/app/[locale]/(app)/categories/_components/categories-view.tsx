/* eslint-disable react-hooks/static-components */
"use client";

import { Input } from "@/components/ui/input";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import {
  ListIcon,
  MagnifyingGlassIcon,
  PiggyBankIcon,
  SquaresFourIcon,
  TagIcon,
  TrashIcon,
  TrendDownIcon,
  TrendUpIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useCategoryMutations } from "../_hooks/use-category-mutations";
import type { CategoryRow } from "../_types/types";
import { DeleteDialog } from "./delete-dialog";
import { CategorySheet } from "./form/category-sheet";

type CategoriesViewProps = {
  data: CategoryRow[];
};

type FilterType = "all" | "EXPENSE" | "INCOME" | "INVESTMENT";
type ViewMode = "grid" | "table";

export function CategoriesView({ data }: CategoriesViewProps) {
  const t = useTranslations("scrn-categories");
  const mutations = useCategoryMutations();

  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

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
      const matchesSearch = (cat.name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            {t("title")}
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {t("counts", { count: data.length })}
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("subtitle")}
          </p>
        </div>
        <button
          onClick={() => setDialogState({ mode: "create" })}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all self-start sm:self-auto">
          {t("buttons.add")}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">
              {t("kpi.total.title")}
            </span>
            <TagIcon className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black">{kpis.total}</div>
          <span className="text-[11px] text-slate-400">
            {t("kpi.total.description")}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-rose-500">
              {t("kpi.expenses.title")}
            </span>
            <TrendDownIcon className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {kpis.expenses}
          </div>
          <span className="text-[11px] text-slate-400">
            {t("kpi.expenses.description")}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-500">
              {t("kpi.incomes.title")}
            </span>
            <TrendUpIcon className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {kpis.incomes}
          </div>
          <span className="text-[11px] text-slate-400">
            {t("kpi.incomes.description")}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-500">
              {t("kpi.investments.title")}
            </span>
            <PiggyBankIcon className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {kpis.investments}
          </div>
          <span className="text-[11px] text-slate-400">
            {t("kpi.investments.description")}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className=" flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
        <div className="relative w-full max-w-md">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("filters.searchPlaceholder")}
            className="h-9 pl-9 pr-8"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label={t("filters.clearSearch", { fallback: "Clear" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <XIcon className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold gap-1 overflow-x-auto">
            {(["all", "EXPENSE", "INCOME", "INVESTMENT"] as const).map(
              (type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all",
                    filterType === type
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900",
                  )}>
                  {t(`filters.${type.toLowerCase()}`)}
                </button>
              ),
            )}
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                viewMode === "grid"
                  ? "bg-white dark:bg-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-900",
              )}>
              <SquaresFourIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                viewMode === "table"
                  ? "bg-white dark:bg-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-900",
              )}>
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredData.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <TagIcon className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {t("table.empty.title")}
          </p>
          <p className="text-[11px] text-slate-400">
            {t("table.empty.description")}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredData.map((cat) => {
            const Icon = resolveCategoryIcon(cat.icon);
            const isSystem = cat.userId === null;
            const catType = cat.type || "EXPENSE";
            return (
              <div
                key={cat.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-3 group"
                onClick={() => {
                  if (!isSystem) setDialogState({ mode: "edit", row: cat });
                }}>
                <div className="flex items-center gap-3 min-w-0 cursor-pointer">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0",
                      cat.colorStyle ||
                        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                    )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <h3 className="font-bold text-xs truncate">{cat.name}</h3>
                    <span
                      className={cn(
                        "text-[11px] font-bold flex items-center gap-1",
                        catType === "EXPENSE" &&
                          "text-rose-600 dark:text-rose-400",
                        catType === "INCOME" &&
                          "text-emerald-600 dark:text-emerald-400",
                        catType === "INVESTMENT" &&
                          "text-indigo-600 dark:text-indigo-400",
                      )}>
                      {catType === "EXPENSE" && (
                        <TrendDownIcon className="w-3 h-3" />
                      )}
                      {catType === "INCOME" && (
                        <TrendUpIcon className="w-3 h-3" />
                      )}
                      {catType === "INVESTMENT" && (
                        <PiggyBankIcon className="w-3 h-3" />
                      )}
                      {t(`fields.type.${catType.toLowerCase()}`)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                      isSystem
                        ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
                    )}>
                    {t(`table.origin.${isSystem ? "system" : "custom"}`)}
                  </span>
                  {!isSystem && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingCategory(cat);
                      }}
                      className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg transition-colors">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                <th className="p-3.5 pl-5">{t("table.columns.name")}</th>
                <th className="p-3.5">{t("table.columns.type")}</th>
                <th className="p-3.5">{t("table.columns.origin")}</th>
                <th className="p-3.5 text-right pr-5">
                  {t("table.columns.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredData.map((cat) => {
                const Icon = resolveCategoryIcon(cat.icon);
                const isSystem = cat.userId === null;
                const catType = cat.type || "EXPENSE";
                return (
                  <tr
                    key={cat.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td
                      className="p-3.5 pl-5 font-bold cursor-pointer"
                      onClick={() => {
                        if (!isSystem)
                          setDialogState({ mode: "edit", row: cat });
                      }}>
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            cat.colorStyle ||
                              "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                          )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span>{cat.name}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={cn(
                          "font-bold text-[11px]",
                          catType === "EXPENSE" && "text-rose-600",
                          catType === "INCOME" && "text-emerald-600",
                          catType === "INVESTMENT" && "text-indigo-600",
                        )}>
                        {t(`fields.type.${catType.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                          isSystem
                            ? "bg-slate-100 text-slate-600"
                            : "bg-emerald-50 text-emerald-700",
                        )}>
                        {t(`table.origin.${isSystem ? "system" : "custom"}`)}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      {!isSystem ? (
                        <button
                          onClick={() => setDeletingCategory(cat)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
