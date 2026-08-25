"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Funnel } from "@phosphor-icons/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AccountOption, CategoryOption, SheetFilters } from "../../_types/types";

type FiltersSheetProps = {
  filters: SheetFilters;
  onChange: (filters: SheetFilters) => void;
  accounts: AccountOption[];
  categories: CategoryOption[];
};

const ALL_VALUE = "__all__";

// A filter counts as "active" once it differs from its unset value —
// `undefined` for the two selects, "all" for the type toggle. Shared
// between the trigger badge (counts the applied `filters`) and the Clear
// button (counts the in-progress `draft`). Search and the period range
// aren't this sheet's concern anymore — see the SheetFilters comment in
// _types/types.ts — so unlike the old version this only ever looks at
// exactly these three keys.
function countActiveFilters(value: SheetFilters) {
  let count = 0;
  if (value.accountId) count++;
  if (value.categoryId) count++;
  if (value.type && value.type !== "all") count++;
  return count;
}

export function FiltersSheet({
  filters,
  onChange,
  accounts,
  categories,
}: FiltersSheetProps) {
  const t = useTranslations("scrn-transactions");
  const [open, setOpen] = useState(false);
  // Editing happens on a local draft — nothing reaches the transaction
  // list (and no re-fetch happens) until "Aplicar" is pressed. Reopening
  // the sheet re-syncs the draft from the currently applied `filters`,
  // so abandoning edits (closing without applying) just discards them.
  const [draft, setDraft] = useState<SheetFilters>(filters);

  const activeCount = countActiveFilters(filters);
  const hasDraftFilters = countActiveFilters(draft) > 0;
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(filters);

  function handleOpenChange(next: boolean) {
    if (next) setDraft(filters);
    setOpen(next);
  }

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    onChange(draft);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-8 gap-2">
          <Funnel />
          {t("filters.title")}
          {activeCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col data-[side=right]:sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("filters.title")}</SheetTitle>
          <SheetDescription>{t("filters.description")}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleApply} className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 px-6 pb-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-account">{t("filters.account")}</Label>
              <Select
                value={draft.accountId ?? ALL_VALUE}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    accountId: value === ALL_VALUE ? undefined : value,
                  })
                }
              >
                <SelectTrigger id="filter-account" className="w-full">
                  <SelectValue placeholder={t("filters.account")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>{t("filters.allAccounts")}</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-category">{t("filters.category")}</Label>
              <Select
                value={draft.categoryId ?? ALL_VALUE}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    categoryId: value === ALL_VALUE ? undefined : value,
                  })
                }
              >
                <SelectTrigger id="filter-category" className="w-full">
                  <SelectValue placeholder={t("filters.category")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>{t("filters.allCategories")}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
              <Label>{t("fields.type.label")}</Label>
              <ToggleGroup
                type="single"
                variant="tabs"
                value={draft.type ?? "all"}
                onValueChange={(value) => {
                  if (value) {
                    setDraft({
                      ...draft,
                      type: value as SheetFilters["type"],
                    });
                  }
                }}
                className="w-full justify-start"
              >
                <ToggleGroupItem value="all" className="flex-1">{t("tabs.all")}</ToggleGroupItem>
                <ToggleGroupItem value="income" className="flex-1">{t("tabs.income")}</ToggleGroupItem>
                <ToggleGroupItem value="expenses" className="flex-1">{t("tabs.expenses")}</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <SheetFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setDraft({})}
              disabled={!hasDraftFilters}
            >
              {t("filters.clear")}
            </Button>
            <Button type="submit" className="flex-1" disabled={!hasChanges}>
              {t("filters.apply")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
