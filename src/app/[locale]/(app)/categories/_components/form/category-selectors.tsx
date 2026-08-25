import type { CategoryType } from "@/generated/prisma/client";
import { AVAILABLE_ICONS, resolveCategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import {
  PiggyBankIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { AVAILABLE_COLORS, ColorPicker as CategoryColorPicker } from "@/components/form/color-picker";

export { AVAILABLE_COLORS, CategoryColorPicker };

export function CategoryPreviewCard({
  name,
  type,
  icon,
  colorStyle,
  isSystem = false,
}: {
  name: string;
  type: CategoryType;
  icon?: string | null;
  colorStyle?: string | null;
  isSystem?: boolean;
}) {
  const t = useTranslations("scrn-categories");
  const Icon = resolveCategoryIcon(icon);

  return (
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
        {t("drawer.previewTitle")}
      </span>
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 transition-all",
              colorStyle ||
                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
            )}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="truncate">
            <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
              {name || t("fields.name.label")}
            </span>
            <span
              className={cn(
                "inline-block text-[10px] font-semibold",
                type === "EXPENSE" && "text-rose-600 dark:text-rose-400",
                type === "INCOME" && "text-emerald-600 dark:text-emerald-400",
                type === "INVESTMENT" && "text-indigo-600 dark:text-indigo-400",
              )}>
              • {t(`fields.type.${type.toLowerCase()}`)}
            </span>
          </div>
        </div>

        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0",
            isSystem
              ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
          )}>
          {t(`table.origin.${isSystem ? "system" : "custom"}`)}
        </span>
      </div>
    </div>
  );
}

export function CategoryTypeSelector({
  value,
  onChange,
}: {
  value: CategoryType;
  onChange: (val: CategoryType) => void;
}) {
  const t = useTranslations("scrn-categories");

  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        onClick={() => onChange("EXPENSE")}
        className={cn(
          "p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all",
          value === "EXPENSE"
            ? "border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900"
            : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
        )}>
        <TrendDownIcon className="w-4 h-4" />
        <span>{t("fields.type.expense")}</span>
      </button>

      <button
        type="button"
        onClick={() => onChange("INCOME")}
        className={cn(
          "p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all",
          value === "INCOME"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900"
            : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
        )}>
        <TrendUpIcon className="w-4 h-4" />
        <span>{t("fields.type.income")}</span>
      </button>

      <button
        type="button"
        onClick={() => onChange("INVESTMENT")}
        className={cn(
          "p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all",
          value === "INVESTMENT"
            ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900"
            : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
        )}>
        <PiggyBankIcon className="w-4 h-4" />
        <span>{t("fields.type.investment")}</span>
      </button>
    </div>
  );
}



export function CategoryIconPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (val: string) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 max-h-48 overflow-y-auto">
      {AVAILABLE_ICONS.map((iconKey) => {
        const Icon = resolveCategoryIcon(iconKey);
        return (
          <button
            key={iconKey}
            type="button"
            onClick={() => onChange(iconKey)}
            className={cn(
              "p-2 rounded-xl border flex items-center justify-center transition-all",
              value === iconKey
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
            )}>
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
