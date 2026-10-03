"use client";

import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatMoney, formatMonthShort } from "../../_lib/format-payoff";
import type { PayoffItem } from "../../_types/types";

// The pieces both the desktop table (columns.tsx) and the mobile list
// (payoff-mobile-list.tsx) render for a row — one place for each, so the
// two layouts can't disagree on what a row says.

export function PurchaseCell({ item }: { item: PayoffItem }) {
  const t = useTranslations("scrn-card-payoff");
  const format = useFormatter();

  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-sm font-medium">
        {item.kind === "paid"
          ? t("table.paidAdjustment", { month: formatMonthShort(format, item.lastMonth) })
          : item.description}
      </span>
      <span className="truncate text-xs text-muted-foreground">{item.cardName}</span>
    </div>
  );
}

export function InstallmentsCell({ item }: { item: PayoffItem }) {
  const t = useTranslations("scrn-card-payoff");

  if (item.kind === "paid") return null;
  if (!item.isInstallment || item.installmentCount === null) {
    return <span className="text-sm text-muted-foreground">{t("table.oneOff")}</span>;
  }

  return (
    <div className="flex flex-col">
      <span className="text-sm">
        {item.firstNumber === item.lastNumber
          ? t("table.installmentSingle", {
              number: item.firstNumber ?? 0,
              count: item.installmentCount,
            })
          : t("table.installmentRange", {
              first: item.firstNumber ?? 0,
              last: item.lastNumber ?? 0,
              count: item.installmentCount,
            })}
      </span>
      <span className="text-xs text-muted-foreground">
        {t("table.remainingCount", { count: item.remainingCount })}
      </span>
    </div>
  );
}

// What's owed reads as money going out; a "já pago" line (negative)
// reads as money already in.
export function MoneyCell({
  value,
  muted = false,
  className,
}: {
  value: number;
  muted?: boolean;
  className?: string;
}) {
  const format = useFormatter();

  return (
    <span
      className={cn(
        "tabular-nums",
        muted ? "text-muted-foreground" : value < 0 ? "text-positive" : "text-negative",
        className,
      )}
    >
      {formatMoney(format, value)}
    </span>
  );
}

export function MonthCell({ monthKey }: { monthKey: string }) {
  const format = useFormatter();

  return <span className="text-sm">{formatMonthShort(format, monthKey)}</span>;
}

// The mobile list's second line: "3 parcelas de R$ 70,50 · até Dez/26".
export function ParcelSummary({ item }: { item: PayoffItem }) {
  const t = useTranslations("scrn-card-payoff");
  const format = useFormatter();

  if (item.kind === "paid") return null;

  return (
    <span className="shrink-0">
      {item.isInstallment
        ? t("table.mobileSummary", {
            count: item.remainingCount,
            amount: formatMoney(format, item.installmentAmount),
            month: formatMonthShort(format, item.lastMonth),
          })
        : t("table.oneOff")}
    </span>
  );
}
