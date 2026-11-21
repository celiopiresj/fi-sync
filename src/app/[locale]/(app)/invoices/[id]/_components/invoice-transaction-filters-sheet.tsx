"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Funnel } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
// Deliberate cross-route dependency, same exception as the rest of this
// route (see invoice-detail-view.tsx's own comment) — CategoryOption/
// PersonOption already carry exactly the shape this needs.
import type {
  CategoryOption,
  PersonOption,
} from "../../../transactions/_types/types";
import type { InvoiceTransactionFilters } from "../_types/types";

type InvoiceTransactionFiltersSheetProps = {
  filters: InvoiceTransactionFilters;
  onChange: (filters: InvoiceTransactionFilters) => void;
  categories: CategoryOption[];
  people: PersonOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const ALL_VALUE = "__all__";

// Deliberately narrower than /transactions' own FiltersSheet — Account/
// Card and a date range don't apply here: every row already belongs to
// this one invoice's account (the card tabs above already split by
// physical card when there's more than one), and every row already
// falls inside this invoice's own closing cycle.
function countActiveFilters(value: InvoiceTransactionFilters) {
  let count = 0;
  if (value.categoryId) count++;
  if (value.personId) count++;
  if (value.type && value.type !== "all") count++;
  return count;
}

export function MobileInvoiceTransactionFiltersTrigger({
  filters,
  onClick,
}: {
  filters: InvoiceTransactionFilters;
  onClick: () => void;
}) {
  const t = useTranslations("scrn-invoices");
  const activeCount = countActiveFilters(filters);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      aria-label={t("detail.transactions.filters.title")}
      className="relative size-11 rounded-xl border-border/80 bg-card shadow-xs sm:hidden">
      <Funnel aria-hidden="true" className="size-5" />
      {activeCount > 0 && (
        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold tabular-nums text-primary-foreground">
          {activeCount}
        </span>
      )}
    </Button>
  );
}

export function InvoiceTransactionFiltersSheet({
  filters,
  onChange,
  categories,
  people,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: InvoiceTransactionFiltersSheetProps) {
  const t = useTranslations("scrn-invoices");
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  // Same "edit on a local draft, only apply on submit" behavior as
  // /transactions' own FiltersSheet.
  const [draft, setDraft] = useState<InvoiceTransactionFilters>(filters);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(filters);
  }

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
        <Button
          variant="outline"
          className="hidden h-9 gap-2 sm:order-2 sm:inline-flex">
          <Funnel aria-hidden="true" />
          {t("detail.transactions.filters.title")}
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs tabular-nums text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        closeLabel={t("aria.close")}
        className="flex flex-col overflow-y-auto data-[side=right]:sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("detail.transactions.filters.title")}</SheetTitle>
          <SheetDescription>
            {t("detail.transactions.filters.description")}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleApply} className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-5 px-6 pb-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice-filter-category">
                {t("detail.transactions.filters.category")}
              </Label>
              <Select
                value={draft.categoryId ?? ALL_VALUE}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    categoryId: value === ALL_VALUE ? undefined : value,
                  })
                }>
                <SelectTrigger id="invoice-filter-category" className="w-full">
                  <SelectValue
                    placeholder={t("detail.transactions.filters.category")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>
                    {t("detail.transactions.filters.allCategories")}
                  </SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice-filter-person">
                {t("detail.transactions.filters.person")}
              </Label>
              <Select
                value={draft.personId ?? ALL_VALUE}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    personId: value === ALL_VALUE ? undefined : value,
                  })
                }>
                <SelectTrigger id="invoice-filter-person" className="w-full">
                  <SelectValue
                    placeholder={t("detail.transactions.filters.person")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>
                    {t("detail.transactions.filters.allPeople")}
                  </SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("detail.transactions.filters.type")}</Label>
              <ToggleGroup
                type="single"
                variant="tabs"
                value={draft.type ?? "all"}
                onValueChange={(value) => {
                  if (value) {
                    setDraft({
                      ...draft,
                      type: value as InvoiceTransactionFilters["type"],
                    });
                  }
                }}
                className="w-full justify-start">
                <ToggleGroupItem value="all" className="flex-1">
                  {t("detail.transactions.filters.allTypes")}
                </ToggleGroupItem>
                <ToggleGroupItem value="income" className="flex-1">
                  {t("detail.transactions.filters.income")}
                </ToggleGroupItem>
                <ToggleGroupItem value="expenses" className="flex-1">
                  {t("detail.transactions.filters.expenses")}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <SheetFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setDraft({})}
              disabled={!hasDraftFilters}>
              {t("detail.transactions.filters.clear")}
            </Button>
            <Button type="submit" className="flex-1" disabled={!hasChanges}>
              {t("detail.transactions.filters.apply")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
