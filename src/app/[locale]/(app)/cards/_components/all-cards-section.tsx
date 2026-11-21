"use client";

import {
  ViewModeToggle,
  type ViewMode,
} from "@/components/screen/view-mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CreditCardIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { CreditCardAccountRow } from "../_types/types";
import { CardTable } from "./card-table";
import { CardTile } from "./card-tile";

type StatusFilter = "all" | "active" | "disabled";

type AllCardsSectionProps = {
  accounts: CreditCardAccountRow[];
  onEdit: (id: string) => void;
  onToggleStatus: (account: CreditCardAccountRow) => void;
  onDelete: (account: CreditCardAccountRow) => void;
};

// Every account below the 95% attention threshold — hidden entirely if
// every account happens to be critical right now, same "no empty
// section heading" rule as AttentionSection. The active/disabled tabs
// filter this same list client-side (accounts is already fetched in
// full); accounts.length in the "Todos" label stays the total
// regardless of which tab is selected. viewMode swaps between the
// CardTile grid and CardTable's denser rows — same filtered accounts
// either way (ViewModeToggle, shared across the app's list screens).
export function AllCardsSection({
  accounts,
  onEdit,
  onToggleStatus,
  onDelete,
}: AllCardsSectionProps) {
  const t = useTranslations("scrn-cards");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const activeCount = accounts.filter(
    (account) => account.status === "ACTIVE",
  ).length;
  const disabledCount = accounts.length - activeCount;

  const filteredAccounts = useMemo(() => {
    if (statusFilter === "active") {
      return accounts.filter((account) => account.status === "ACTIVE");
    }
    if (statusFilter === "disabled") {
      return accounts.filter((account) => account.status === "INACTIVE");
    }
    return accounts;
  }, [accounts, statusFilter]);

  if (accounts.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold text-foreground">
          {t("sections.all.title")}
        </h2>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <ToggleGroup
            type="single"
            variant="tabs"
            size="sm"
            value={statusFilter}
            onValueChange={(value) => {
              if (value) setStatusFilter(value as StatusFilter);
            }}
            className="w-full sm:w-auto"
          >
            <ToggleGroupItem value="all" className="h-9 grow sm:h-7 sm:grow-0">
              {t("sections.all.filters.all", { count: accounts.length })}
            </ToggleGroupItem>
            <ToggleGroupItem value="active" className="h-9 grow sm:h-7 sm:grow-0">
              {t("sections.all.filters.active", { count: activeCount })}
            </ToggleGroupItem>
            <ToggleGroupItem value="disabled" className="h-9 grow sm:h-7 sm:grow-0">
              {t("sections.all.filters.disabled", { count: disabledCount })}
            </ToggleGroupItem>
          </ToggleGroup>
          <ViewModeToggle
            value={viewMode}
            onValueChange={setViewMode}
            cardsLabel={t("viewMode.cards")}
            listLabel={t("viewMode.list")}
          />
        </div>
      </div>

      {filteredAccounts.length === 0 ? (
        <Empty className="border-none py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CreditCardIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("empty.filtered.title")}</EmptyTitle>
            <EmptyDescription>
              {t("empty.filtered.description")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              className="h-11 sm:h-8"
              onClick={() => setStatusFilter("all")}>
              {t("empty.filtered.button")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAccounts.map((account) => (
            <CardTile
              key={account.id}
              account={account}
              onEdit={() => onEdit(account.id)}
              onToggleStatus={onToggleStatus}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="hidden min-[700px]:block">
            <CardTable
              accounts={filteredAccounts}
              onEdit={onEdit}
              onToggleStatus={onToggleStatus}
              onDelete={onDelete}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 min-[700px]:hidden">
            {filteredAccounts.map((account) => (
              <CardTile
                key={account.id}
                account={account}
                onEdit={() => onEdit(account.id)}
                onToggleStatus={onToggleStatus}
                onDelete={onDelete}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
