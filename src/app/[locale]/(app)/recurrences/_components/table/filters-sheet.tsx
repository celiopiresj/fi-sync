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
import type { RecurrenceSheetFilters } from "../../_schema/schema";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
} from "../../_types/types";
import {
  ALL_CARDS_ACCOUNT_FILTER,
  ALL_NON_CARD_ACCOUNTS_FILTER,
  isAccountGroupFilter,
} from "../../_constants/constants";
import {
  accountIdForKind,
  resolveAccountKind,
  type AccountKind,
} from "../../_lib/account-kind";

type FiltersSheetProps = {
  filters: RecurrenceSheetFilters;
  onChange: (filters: RecurrenceSheetFilters) => void;
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  // Which Débito/Crédito tab (recurrences-view.tsx) is active — the sheet
  // only shows the ONE account select matching it, same as transactions'
  // own filters-sheet.tsx: the tab decides "which universe," this sheet
  // only narrows within it.
  accountKind: AccountKind;
};

const ALL_VALUE = "__all__";

// A filter counts as "active" once it differs from its unset value —
// `undefined` for the two selects, "all" for type, "active" for status
// (the screen's own default — see the RecurrenceFilters doc comment in
// actions.ts). Mirrors transactions' filters-sheet.tsx countActiveFilters.
function countActiveFilters(value: RecurrenceSheetFilters) {
  let count = 0;
  // A group sentinel is just the active Débito/Crédito tab, not a real
  // narrowing — only a specific account counts.
  if (value.accountId && !isAccountGroupFilter(value.accountId)) count++;
  if (value.categoryId) count++;
  if (value.personId) count++;
  if (value.type && value.type !== "all") count++;
  if (value.status && value.status !== "active") count++;
  return count;
}

export function FiltersSheet({
  filters,
  onChange,
  accounts,
  categories,
  people,
  accountKind,
}: FiltersSheetProps) {
  const t = useTranslations("scrn-recurrences");
  const [open, setOpen] = useState(false);
  // Editing happens on a local draft — nothing reaches the recurrences
  // list (and no re-fetch happens) until "Aplicar" is pressed. Reopening
  // the sheet re-syncs the draft from the currently applied `filters`,
  // so abandoning edits (closing without applying) just discards them.
  const [draft, setDraft] = useState<RecurrenceSheetFilters>(filters);

  const activeCount = countActiveFilters(filters);
  const hasDraftFilters = countActiveFilters(draft) > 0;
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(filters);

  // Separate "Conta"/"Cartão" selects (only one renders, per accountKind)
  // — both still write into the same `accountId` value.
  const cardAccounts = accounts.filter((account) => account.type === "CREDIT_CARD");
  const nonCardAccounts = accounts.filter((account) => account.type !== "CREDIT_CARD");

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
            {accountKind === "debit" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-account">{t("filters.account")}</Label>
                <Select
                  value={
                    draft.accountId === ALL_NON_CARD_ACCOUNTS_FILTER ||
                    nonCardAccounts.some((account) => account.id === draft.accountId)
                      ? draft.accountId
                      : ""
                  }
                  onValueChange={(value) => setDraft({ ...draft, accountId: value })}
                >
                  <SelectTrigger id="filter-account" className="w-full">
                    <SelectValue placeholder={t("filters.account")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_NON_CARD_ACCOUNTS_FILTER}>
                      {t("filters.allNonCardAccounts")}
                    </SelectItem>
                    {nonCardAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {accountKind === "credit" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-card">{t("filters.card")}</Label>
                <Select
                  value={
                    draft.accountId === ALL_CARDS_ACCOUNT_FILTER ||
                    cardAccounts.some((account) => account.id === draft.accountId)
                      ? draft.accountId
                      : ""
                  }
                  onValueChange={(value) => setDraft({ ...draft, accountId: value })}
                >
                  <SelectTrigger id="filter-card" className="w-full">
                    <SelectValue placeholder={t("filters.card")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_CARDS_ACCOUNT_FILTER}>
                      {t("filters.allCards")}
                    </SelectItem>
                    {cardAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-person">{t("filters.person")}</Label>
              <Select
                value={draft.personId ?? ALL_VALUE}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    personId: value === ALL_VALUE ? undefined : value,
                  })
                }
              >
                <SelectTrigger id="filter-person" className="w-full">
                  <SelectValue placeholder={t("filters.person")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>{t("filters.allPeople")}</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
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
                      type: value as RecurrenceSheetFilters["type"],
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

            <div className="flex flex-col gap-1.5">
              <Label>{t("filters.status")}</Label>
              <ToggleGroup
                type="single"
                variant="tabs"
                value={draft.status ?? "active"}
                onValueChange={(value) => {
                  if (value) {
                    setDraft({
                      ...draft,
                      status: value as RecurrenceSheetFilters["status"],
                    });
                  }
                }}
                className="w-full justify-start"
              >
                <ToggleGroupItem value="active" className="flex-1">
                  {t("status.active")}
                </ToggleGroupItem>
                <ToggleGroupItem value="finished" className="flex-1">
                  {t("status.finished")}
                </ToggleGroupItem>
                <ToggleGroupItem value="all" className="flex-1">
                  {t("status.all")}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <SheetFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              // Broadens back to "every account of this kind" instead of
              // wiping accountId — clearing narrows back to the active tab,
              // it doesn't leave it (same as transactions' own sheet).
              onClick={() =>
                setDraft({ accountId: accountIdForKind(resolveAccountKind(draft.accountId, accounts)) })
              }
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
