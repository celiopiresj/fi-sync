"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, Link } from "@/i18n/navigation";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { DATE_ONLY_FORMAT_OPTIONS } from "@/lib/date";
import { MarkPaidDialog } from "./mark-paid-dialog";
import type { InvoiceDetail, PayableAccountOption } from "../../_types/types";

const statusVariant: Record<
  InvoiceDetail["displayStatus"],
  "default" | "secondary" | "outline"
> = {
  OPEN: "outline",
  CLOSED: "secondary",
  PAID: "default",
};

type InvoiceDetailViewProps = {
  invoice: InvoiceDetail;
  accounts: PayableAccountOption[];
};

export function InvoiceDetailView({ invoice, accounts }: InvoiceDetailViewProps) {
  const t = useTranslations("scrn-invoices");
  const format = useFormatter();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [markPaidOpen, setMarkPaidOpen] = useState(false);

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  // No dedicated hook for this one-off invalidation (unlike
  // useInvoicesData's own `invalidate`) — this page has no list query of
  // its own to own the queryClient for; it just needs to tell the
  // /invoices list and /cards' available-limit figure to refetch, plus
  // re-render its own Server Component (router.refresh()) so
  // `invoice.displayStatus`/`paidAmount` reflect the just-saved PAID
  // state without a full navigation.
  function handlePaid() {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["credit-card-accounts"] });
    // Paying an invoice now creates an expense Transaction on the chosen
    // account (see markInvoicePaid in actions.ts), which changes that
    // account's balance on /accounts.
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <Link
        href="/invoices"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("detail.back")}
      </Link>

      <div className="flex flex-col gap-4 rounded-lg bg-surface-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold">{invoice.account.name}</h1>
            <p className="text-sm text-muted-foreground">
              {t("detail.summary.period", {
                closing: format.dateTime(invoice.closingDate, DATE_ONLY_FORMAT_OPTIONS),
                due: format.dateTime(invoice.dueDate, DATE_ONLY_FORMAT_OPTIONS),
              })}
            </p>
          </div>
          <Badge variant={statusVariant[invoice.displayStatus]}>
            {t(`status.${invoice.displayStatus.toLowerCase()}`)}
          </Badge>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {t("detail.summary.total")}
          </span>
          <span className="text-[28px] font-medium tabular-nums text-negative">
            {money(invoice.total)}
          </span>
        </div>

        {invoice.displayStatus === "PAID" && invoice.paidAt ? (
          <p className="text-xs text-muted-foreground">
            {t("detail.paidSummary", {
              date: format.dateTime(invoice.paidAt, DATE_ONLY_FORMAT_OPTIONS),
              amount: money(invoice.paidAmount ?? 0),
            })}
          </p>
        ) : (
          <Button onClick={() => setMarkPaidOpen(true)} className="w-fit">
            {t("detail.markPaid.button")}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t("detail.transactions.title")}</h2>

        {invoice.transactions.length === 0 ? (
          <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            {t("detail.transactions.empty")}
          </p>
        ) : (
          <div className="rounded-md border border-border">
            <div className="divide-y divide-border">
              {invoice.transactions.map((transaction) => {
                const CategoryIcon = resolveCategoryIcon(transaction.category?.icon);
                // Same "join only when both are present, else show the
                // one that is" pattern as transactions' own columns.tsx
                // subtitleJoin — here across category name + physical
                // card name instead of category + payment method.
                const parts = [transaction.category?.name, transaction.card?.name].filter(
                  (part): part is string => Boolean(part),
                );
                const categoryCardLine =
                  parts.length === 2
                    ? t("detail.transactions.categoryCardJoin", {
                        category: parts[0],
                        card: parts[1],
                      })
                    : parts[0];
                const formattedDate = format.dateTime(
                  transaction.date,
                  DATE_ONLY_FORMAT_OPTIONS,
                );
                // Same "join only when both are present" pattern as
                // categoryCardLine above, one level up — date is always
                // there, categoryCardLine is optional.
                const subtitle = categoryCardLine
                  ? t("detail.transactions.subtitleJoin", {
                      date: formattedDate,
                      detail: categoryCardLine,
                    })
                  : formattedDate;

                return (
                  <div key={transaction.id} className="flex items-center gap-3 px-3 py-2.5">
                    <CategoryIcon className="size-5 shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="min-w-0 truncate text-sm font-medium">
                        {transaction.description}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {subtitle}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-negative">
                      {money(Math.abs(transaction.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <MarkPaidDialog
        open={markPaidOpen}
        onOpenChange={setMarkPaidOpen}
        invoiceId={invoice.id}
        defaultAmount={invoice.total}
        accounts={accounts}
        onPaid={handlePaid}
      />
    </div>
  );
}
