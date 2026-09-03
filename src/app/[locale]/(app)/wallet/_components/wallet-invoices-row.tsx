"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CaretRightIcon, ReceiptIcon } from "@phosphor-icons/react";
import type { WalletOverview } from "../_types/types";

type WalletInvoicesRowProps = {
  overview: WalletOverview;
};

export function WalletInvoicesRow({ overview }: WalletInvoicesRowProps) {
  const t = useTranslations("scrn-wallet");
  const format = useFormatter();

  return (
    <Link
      href="/invoices"
      className="flex items-center gap-3 rounded-lg border border-border p-4"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
        <ReceiptIcon className="size-4.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{t("cards.invoices.title")}</span>
        <span className="truncate text-xs text-muted-foreground">
          {t("cards.invoices.subtitle", { count: overview.openInvoicesCount })}
        </span>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-warning">
        {format.number(overview.invoicesDueThisMonth, { style: "currency", currency: "BRL" })}
      </span>
      <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
