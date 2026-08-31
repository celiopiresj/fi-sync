import { createElement, type ReactNode } from "react";
import type { CategoryType } from "@/generated/prisma/client";
import { AVAILABLE_ICONS, resolveCategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  PiggyBankIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { AVAILABLE_COLORS, ColorPicker as CategoryColorPicker } from "@/components/form/color-picker";

export { AVAILABLE_COLORS, CategoryColorPicker };

// Category type → status token, shared by the preview card, the type
// selector's selected state, and categories-view.tsx's badges/KPIs —
// AGENTS.md's "Status/money colors" convention (expense = negative,
// income = positive; investment has no dedicated token, so it reuses
// "warning" as a third distinct tone rather than inventing a raw color).
// LOAN reuses "negative" too — every loan installment payment is a
// plain expense (see prisma/schema.prisma's CategoryType.LOAN comment)
// — even though it never actually reaches CategoryTypeSelector below
// (system-only, not user-selectable), the Record still needs every
// CategoryType key to type-check.
const TYPE_TEXT: Record<CategoryType, string> = {
  EXPENSE: "text-negative",
  INCOME: "text-positive",
  INVESTMENT: "text-warning",
  LOAN: "text-negative",
};

// Written as full literal class strings (not built by string
// concatenation) so Tailwind's static build-time scanner can see and
// generate each `data-[state=on]:*` utility — a dynamically-assembled
// string wouldn't be picked up by the scanner.
const TYPE_SELECTED: Record<CategoryType, string> = {
  EXPENSE:
    "data-[state=on]:border-negative/40 data-[state=on]:bg-negative/10 data-[state=on]:text-negative",
  INCOME:
    "data-[state=on]:border-positive/40 data-[state=on]:bg-positive/10 data-[state=on]:text-positive",
  INVESTMENT:
    "data-[state=on]:border-warning/40 data-[state=on]:bg-warning/10 data-[state=on]:text-warning",
  LOAN:
    "data-[state=on]:border-negative/40 data-[state=on]:bg-negative/10 data-[state=on]:text-negative",
};

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

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4">
      <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("drawer.previewTitle")}
      </span>
      <Card radius="lg">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg transition-all",
                colorStyle || "bg-muted text-muted-foreground",
              )}
            >
              {createElement(resolveCategoryIcon(icon), { className: "size-5" })}
            </div>
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {name || t("fields.name.label")}
              </span>
              <span
                className={cn(
                  "inline-block text-xs font-medium",
                  TYPE_TEXT[type],
                )}
              >
                {t(`fields.type.${type.toLowerCase()}`)}
              </span>
            </div>
          </div>

          <Badge variant={isSystem ? "secondary" : "outline"} className="shrink-0">
            {t(`table.origin.${isSystem ? "system" : "custom"}`)}
          </Badge>
        </div>
      </Card>
    </div>
  );
}

// LOAN is system-only (see prisma/schema.prisma's CategoryType.LOAN
// comment) — never one of the choices here, so this selector's own
// value type excludes it rather than widening to the full CategoryType.
type SelectableCategoryType = Exclude<CategoryType, "LOAN">;

export function CategoryTypeSelector({
  value,
  onChange,
}: {
  value: SelectableCategoryType;
  onChange: (val: SelectableCategoryType) => void;
}) {
  const t = useTranslations("scrn-categories");

  const options: { type: SelectableCategoryType; icon: ReactNode }[] = [
    { type: "EXPENSE", icon: <TrendDownIcon className="size-4" /> },
    { type: "INCOME", icon: <TrendUpIcon className="size-4" /> },
    { type: "INVESTMENT", icon: <PiggyBankIcon className="size-4" /> },
  ];

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as SelectableCategoryType);
      }}
      className="grid w-full grid-cols-3 gap-2"
    >
      {options.map(({ type, icon }) => (
        <ToggleGroupItem
          key={type}
          value={type}
          className={cn(
            "h-auto flex-col gap-1 rounded-lg py-2.5 text-xs font-semibold",
            TYPE_SELECTED[type],
          )}
        >
          {icon}
          <span>{t(`fields.type.${type.toLowerCase()}`)}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
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
    <div className="grid max-h-48 grid-cols-6 gap-2 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2">
      {AVAILABLE_ICONS.map((iconKey) => (
        <button
          key={iconKey}
          type="button"
          onClick={() => onChange(iconKey)}
          className={cn(
            "flex items-center justify-center rounded-md border p-2 transition-colors",
            value === iconKey
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          {createElement(resolveCategoryIcon(iconKey), { className: "size-4" })}
        </button>
      ))}
    </div>
  );
}
