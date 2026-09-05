"use client";

import type { CategoryRow } from "@/app/[locale]/(app)/categories/_types/types";
import { AVAILABLE_COLORS, ColorPicker } from "@/components/form/color-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CategoryType } from "@/generated/prisma/client";
import { AVAILABLE_ICONS, resolveCategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import { PencilSimpleIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { createElement, useState } from "react";

export type OnboardingCategory = {
  // Client-generated (crypto.randomUUID()) — not a real Category id yet,
  // since custom categories aren't created in the database until the
  // wizard's final submit. Lets the budget step (budget-step.tsx)
  // reference a not-yet-created category in its own draft items; the
  // final submit (onboarding-wizard.tsx) remaps this to the real id
  // returned by createCategory once the row actually exists.
  id: string;
  name: string;
  // Never LOAN or CARD_PAYMENT — both are system-only (see
  // prisma/schema.prisma's matching comments) and CATEGORY_TYPES below
  // (what a user can actually pick here) excludes them.
  type: Exclude<CategoryType, "LOAN" | "CARD_PAYMENT">;
  colorStyle: string | null;
  icon: string | null;
};

type CategoriesStepProps = {
  seededCategories: CategoryRow[];
  categories: OnboardingCategory[];
  onAdd: (category: OnboardingCategory) => void;
  onUpdate: (index: number, category: OnboardingCategory) => void;
  onRemove: (index: number) => void;
};

// Custom categories a user creates here are only ever EXPENSE/INCOME/
// INVESTMENT — LOAN and CARD_PAYMENT are system-only (see
// prisma/schema.prisma's matching comments), so both are excluded from
// this list. The seeded-categories preview below uses its own, wider
// list instead so the seeded "Empréstimo"/"Fatura de Cartão" categories
// still show up there.
const CATEGORY_TYPES: OnboardingCategory["type"][] = [
  "EXPENSE",
  "INCOME",
  "INVESTMENT",
];
const SEEDED_CATEGORY_TYPES: CategoryType[] = [
  "EXPENSE",
  "INCOME",
  "INVESTMENT",
  "LOAN",
  "CARD_PAYMENT",
];
// 100 of the shared icon set's 126 — this step's own picker, not the
// full CategoryIconPicker (which lives in categories' own route-private
// _components/form/), matching this rewrite's "no reusing the real
// forms" scope.
const ICON_CHOICES = AVAILABLE_ICONS.slice(0, 100);

const EMPTY_FORM: OnboardingCategory = {
  id: "",
  name: "",
  type: "EXPENSE",
  colorStyle: AVAILABLE_COLORS[0].class,
  icon: null,
};

// Optional, repeatable — shows the 30 already-seeded system categories as
// a read-only reference (grouped by type, matching the reference
// implementation's own grouped display) plus a small form below to add
// custom ones on top, with a live preview and editing (pencil loads a
// category back into the form, Add becomes Save/Cancel) — same shape as
// cards-step.tsx.
export function CategoriesStep({
  seededCategories,
  categories,
  onAdd,
  onUpdate,
  onRemove,
}: CategoriesStepProps) {
  const t = useTranslations("scrn-onboarding");
  const tCommon = useTranslations("common");
  const tCategories = useTranslations("scrn-categories");
  const [form, setForm] = useState<OnboardingCategory>(EMPTY_FORM);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditing = editingIndex !== null;

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingIndex(null);
    setError(null);
  }

  function startEditing(index: number) {
    setForm(categories[index]);
    setEditingIndex(index);
    setError(null);
  }

  function handleSubmit() {
    const trimmedName = form.name.trim();
    if (!trimmedName) return;

    // Checked against the seeded set too, not just other drafts — a
    // custom category named the same as an already-seeded one (e.g.
    // "Alimentação") would be just as confusing/redundant in the
    // category picker as two drafts sharing a name.
    const isDuplicate =
      seededCategories.some((c) => c.name === trimmedName) ||
      categories.some((c, i) => c.name === trimmedName && i !== editingIndex);
    if (isDuplicate) {
      setError(t("steps.categories.errors.duplicated"));
      return;
    }
    setError(null);

    const value: OnboardingCategory = {
      ...form,
      name: trimmedName,
      id: isEditing ? form.id : crypto.randomUUID(),
    };
    if (isEditing) {
      onUpdate(editingIndex, value);
    } else {
      onAdd(value);
    }
    resetForm();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">
          {t("steps.categories.seededTitle")}
        </p>
        <div className="flex flex-col gap-3">
          {SEEDED_CATEGORY_TYPES.map((categoryType) => {
            const items = seededCategories.filter(
              (c) => c.type === categoryType,
            );
            if (items.length === 0) return null;

            return (
              <div key={categoryType} className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tCategories(`fields.type.${categoryType.toLowerCase()}`)}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((category) => {
                    const CategoryIcon = resolveCategoryIcon(category.icon);
                    return (
                      <span
                        key={category.id}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                          category.colorStyle ||
                            "bg-muted text-muted-foreground",
                        )}>
                        <CategoryIcon className="size-3.5" />
                        {category.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex flex-col gap-4 rounded-lg border border-border p-4 flex-2">
          <p className="text-sm font-medium">
            {t("steps.categories.addCustomTitle")}
          </p>

          {/* Live preview — same idea as the real CategoryForm's
              CategoryPreviewCard, hand-rolled here since this rewrite
              doesn't reuse the real form components. */}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    form.colorStyle || "bg-muted text-muted-foreground",
                  )}>
                  {createElement(resolveCategoryIcon(form.icon), {
                    className: "size-5",
                  })}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {form.name || tCategories("fields.name.label")}
                  </p>
                  <Badge variant="outline" className="mt-0.5">
                    {tCategories(`fields.type.${form.type.toLowerCase()}`)}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  {tCategories("fields.name.label")}
                </label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder={tCategories("fields.name.placeholder")}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  {tCategories("fields.type.label")}
                </label>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={form.type}
                  onValueChange={(value) =>
                    value &&
                    setForm((prev) => ({
                      ...prev,
                      type: value as OnboardingCategory["type"],
                    }))
                  }
                  className="grid w-full grid-cols-3">
                  {CATEGORY_TYPES.map((option) => (
                    <ToggleGroupItem
                      key={option}
                      value={option}
                      className="flex-1">
                      {tCategories(`fields.type.${option.toLowerCase()}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  {tCategories("fields.color.label")}
                </label>
                <ColorPicker
                  value={form.colorStyle}
                  onChange={(colorStyle) =>
                    setForm((prev) => ({ ...prev, colorStyle }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  {tCategories("fields.icon.label")}
                </label>
                <div className="grid max-h-48 grid-cols-6 gap-1.5 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2">
                  {ICON_CHOICES.map((iconKey) => (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, icon: iconKey }))
                      }
                      className={cn(
                        "flex items-center justify-center rounded-md border p-2 transition-colors",
                        form.icon === iconKey
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}>
                      {createElement(resolveCategoryIcon(iconKey), {
                        className: "size-4",
                      })}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSubmit}
              className="flex-1"
              disabled={!form.name.trim()}>
              {isEditing ? null : <PlusIcon />}
              {isEditing ? tCommon("buttons.save") : t("buttons.add")}
            </Button>
            {isEditing && (
              <Button type="button" variant="ghost" onClick={resetForm}>
                {tCommon("buttons.cancel")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("steps.categories.emptyCustom")}
            </p>
          ) : (
            categories.map((category, index) => {
              const CategoryIcon = resolveCategoryIcon(category.icon);
              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border p-3 min-w-sm",
                    editingIndex === index ? "border-primary" : "border-border",
                  )}>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full",
                        category.colorStyle || "bg-muted text-muted-foreground",
                      )}>
                      <CategoryIcon className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{category.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tCategories(
                          `fields.type.${category.type.toLowerCase()}`,
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEditing(index)}>
                      <PencilSimpleIcon />
                      <span className="sr-only">{tCommon("buttons.edit")}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRemove(index)}>
                      <TrashIcon />
                      <span className="sr-only">{t("buttons.remove")}</span>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
