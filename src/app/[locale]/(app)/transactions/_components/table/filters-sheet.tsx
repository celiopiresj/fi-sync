"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
  SheetFilters,
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
  filters: SheetFilters;
  onChange: (filters: SheetFilters) => void;
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  // Which Débito/Crédito tab (transactions-view.tsx) is active — the
  // sheet only ever shows the ONE account select matching it: showing
  // both let a user pick a card while the Débito tab is active, silently
  // flipping the screen to Crédito with no visible cause. The tab is the
  // single source of truth for "which universe," this sheet only narrows
  // within it.
  accountKind: AccountKind;
};

const ALL_VALUE = "__all__";

// A filter counts as "active" once it differs from its unset value —
// `undefined` for the selects, "all" for the type toggle. Shared between
// the trigger badge (counts the applied `filters`) and the Clear button
// (counts the in-progress `draft`). Search and the period range aren't
// this sheet's concern anymore — see the SheetFilters comment in
// _types/types.ts — so unlike the old version this only ever looks at
// exactly these keys.
function countActiveFilters(value: SheetFilters) {
  let count = 0;
  // A group sentinel is just which Débito/Crédito tab
  // (transactions-view.tsx) is active, not a real narrowing — only a
  // specific account counts here, same rule the chip row follows.
  if (value.accountId && !isAccountGroupFilter(value.accountId)) count++;
  if (value.categoryId) count++;
  if (value.personId) count++;
  if (value.dateFrom || value.dateTo) count++;
  if (value.type && value.type !== "all") count++;
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

  // Cards and non-card accounts (checking/savings/cash/investment/pocket)
  // get their own separate "Conta"/"Cartão" selects below (not one flat
  // list) — both still write into the same `accountId` value, since a
  // transaction only ever belongs to one account either way.
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
            {/* Only one of these two ever renders — which account
                domain is even open to picking from follows the active
                Débito/Crédito tab (accountKind, from transactions-view.tsx),
                not a choice this sheet offers on its own. */}
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

            <div className="flex flex-col gap-3">
              <Label>{t("filters.period")}</Label>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-date-from" className="text-xs font-normal text-muted-foreground">
                  {t("filters.periodFrom")}
                </Label>
                <Input
                  id="filter-date-from"
                  type="date"
                  value={draft.dateFrom ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, dateFrom: e.target.value || undefined })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-date-to" className="text-xs font-normal text-muted-foreground">
                  {t("filters.periodTo")}
                </Label>
                <Input
                  id="filter-date-to"
                  type="date"
                  value={draft.dateTo ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, dateTo: e.target.value || undefined })
                  }
                />
              </div>
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
              // Broadens back to "every account of this kind" instead of
              // wiping accountId to unset — clearing filters narrows back
              // to the tab you're already on, it doesn't leave it (same
              // reasoning as transactions-view.tsx's own "Limpar tudo").
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
