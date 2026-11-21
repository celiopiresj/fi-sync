"use client";

import { useTranslations } from "next-intl";
import { Funnel } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InvoiceAccountOption, InvoiceRow } from "../_types/types";

type StatusFilter = "all" | InvoiceRow["displayStatus"];

const ALL_VALUE = "__all__";

export function MobileInvoiceFiltersTrigger({
  activeCount,
  onClick,
}: {
  activeCount: number;
  onClick: () => void;
}) {
  const t = useTranslations("scrn-invoices");

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      aria-label={t("detail.transactions.filters.title")}
      className="relative size-11 rounded-xl border-border/80 bg-card shadow-xs sm:hidden"
    >
      <Funnel aria-hidden="true" className="size-5" />
      {activeCount > 0 && (
        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold tabular-nums text-primary-foreground">
          {activeCount}
        </span>
      )}
    </Button>
  );
}

type InvoiceFiltersDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: InvoiceAccountOption[];
  accountId: string | undefined;
  onAccountChange: (accountId: string | undefined) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
};

export function InvoiceFiltersDrawer({
  open,
  onOpenChange,
  accounts,
  accountId,
  onAccountChange,
  statusFilter,
  onStatusChange,
}: InvoiceFiltersDrawerProps) {
  const t = useTranslations("scrn-invoices");
  const hasFilters = Boolean(accountId) || statusFilter !== "all";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent showCloseButton={false}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{t("detail.transactions.filters.title")}</DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-col gap-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mobile-invoice-account">{t("filters.account")}</Label>
            <Select
              value={accountId ?? ALL_VALUE}
              onValueChange={(value) =>
                onAccountChange(value === ALL_VALUE ? undefined : value)
              }
            >
              <SelectTrigger id="mobile-invoice-account" className="h-11 w-full">
                <SelectValue placeholder={t("filters.account")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>
                  {t("filters.allAccounts")}
                </SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mobile-invoice-status">{t("filters.status")}</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => onStatusChange(value as StatusFilter)}
            >
              <SelectTrigger id="mobile-invoice-status" className="h-11 w-full">
                <SelectValue placeholder={t("filters.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("status.all")}</SelectItem>
                <SelectItem value="CLOSED">{t("status.closed")}</SelectItem>
                <SelectItem value="OPEN">{t("status.open")}</SelectItem>
                <SelectItem value="PARTIALLY_PAID">
                  {t("status.partiallyPaid")}
                </SelectItem>
                <SelectItem value="PAID">{t("status.paid")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            {hasFilters && (
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => {
                  onAccountChange(undefined);
                  onStatusChange("all");
                }}
              >
                {t("detail.transactions.filters.clear")}
              </Button>
            )}
            <Button
              type="button"
              className="h-11 flex-1"
              onClick={() => onOpenChange(false)}
            >
              {t("detail.transactions.filters.apply")}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
