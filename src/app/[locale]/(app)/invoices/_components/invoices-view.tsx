"use client";

import { DataTable } from "@/components/data-table/data-table";
import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import { PageHeader, PeriodStepper } from "@/components/screen/page-header";
import { SearchInput } from "@/components/screen/search-input";
import {
  ViewModeToggle,
  type ViewMode,
} from "@/components/screen/view-mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Link, useRouter } from "@/i18n/navigation";
import {
  DATE_ONLY_FORMAT_OPTIONS,
  dateOnlyKey,
  parseCalendarDate,
  todayCalendarDate,
} from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  CreditCardIcon,
  LockIcon,
  ReceiptIcon,
} from "@phosphor-icons/react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { PayInvoiceDialog } from "../[id]/_components/pay-invoice-dialog";
import { useInvoicesData } from "../_hooks/use-invoices-data";
import { getAccountColorClasses } from "../_lib/account-color";
import { getDueHint } from "../_lib/due-hint";
import {
  currentInvoicePeriod,
  invoicePeriodsEqual,
  shiftInvoicePeriod,
} from "../_lib/period";
import type {
  InvoiceAccountOption,
  InvoicePeriod,
  InvoiceRow,
  PayableAccountOption,
} from "../_types/types";
import type { InvoiceFilters } from "../actions";
import { getInvoiceColumns } from "./table/columns";
import { InvoiceStatusBadge, invoiceStatusMessageKey } from "./invoice-status-badge";

const ALL_VALUE = "__all__";
type StatusFilter = InvoiceRow["displayStatus"] | "all";

// A payable invoice is one still owing money — CLOSED (never paid) or
// PARTIALLY_PAID (some real payment/credit already landed, balance
// remains). Payment isn't offered while still OPEN (accruing, not yet
// closed) or once fully PAID.
function canPayInvoice(status: InvoiceRow["displayStatus"]): boolean {
  return status === "CLOSED" || status === "PARTIALLY_PAID";
}

type InvoicesViewProps = {
  initialInvoices: InvoiceRow[];
  accounts: InvoiceAccountOption[];
  payableAccounts: PayableAccountOption[];
};

export function InvoicesView({
  initialInvoices,
  accounts,
  payableAccounts,
}: InvoicesViewProps) {
  const t = useTranslations("scrn-invoices");
  const format = useFormatter();
  const router = useRouter();

  const [initialPeriod] = useState(() => currentInvoicePeriod());
  const [period, setPeriod] = useState<InvoicePeriod>(initialPeriod);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [payingInvoice, setPayingInvoice] = useState<InvoiceRow | null>(null);

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  // Status is deliberately NOT part of the server query — filtered
  // client-side below (same split as searchText) so the KPI cards can be
  // computed from the whole period+account set regardless of which
  // status tab is currently selected.
  const filters: InvoiceFilters = useMemo(
    () => ({ accountId, period }),
    [accountId, period],
  );
  const isDefaultFilters =
    !accountId && invoicePeriodsEqual(period, initialPeriod);

  const { invoices, invalidate } = useInvoicesData(
    filters,
    initialInvoices,
    isDefaultFilters,
  );

  const { toPay, toPayCount, open, partiallyPaid, partiallyPaidCount, paid, paidCount, total } =
    useMemo(() => {
      return invoices.reduce(
        (acc, invoice) => {
          acc.total += invoice.total;
          if (invoice.displayStatus === "CLOSED") {
            acc.toPay += invoice.total;
            acc.toPayCount += 1;
          } else if (invoice.displayStatus === "OPEN") {
            acc.open += invoice.total;
          } else if (invoice.displayStatus === "PARTIALLY_PAID") {
            acc.partiallyPaid += invoice.remainingDue;
            acc.partiallyPaidCount += 1;
          } else {
            acc.paid += invoice.total;
            acc.paidCount += 1;
          }
          return acc;
        },
        {
          toPay: 0,
          toPayCount: 0,
          open: 0,
          partiallyPaid: 0,
          partiallyPaidCount: 0,
          paid: 0,
          paidCount: 0,
          total: 0,
        },
      );
    }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (statusFilter !== "all" && invoice.displayStatus !== statusFilter) {
        return false;
      }
      if (!query) return true;
      const matchesAccount = invoice.account.name.toLowerCase().includes(query);
      const matchesAmount = money(invoice.total).toLowerCase().includes(query);
      return matchesAccount || matchesAmount;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, statusFilter, searchText, format]);

  function formatPeriod(closingDate: Date, dueDate: Date) {
    return t("table.period", {
      closing: format.dateTime(closingDate, DATE_ONLY_FORMAT_OPTIONS),
      due: format.dateTime(dueDate, DATE_ONLY_FORMAT_OPTIONS),
    });
  }

  function statusLabel(value: InvoiceRow["displayStatus"]) {
    return t(`status.${invoiceStatusMessageKey(value)}`);
  }

  function handleOpen(row: InvoiceRow) {
    router.push(`/invoices/${row.id}`);
  }

  function handlePaid() {
    invalidate();
    setPayingInvoice(null);
  }

  const columns = useMemo(
    () =>
      getInvoiceColumns(
        {
          columns: {
            account: t("table.columns.account"),
            period: t("table.columns.period"),
            status: t("table.columns.status"),
            total: t("table.columns.total"),
          },
          statusLabel,
          open: t("table.open"),
        },
        money,
        formatPeriod,
        { onOpen: handleOpen },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, format],
  );

  const periodLabelDate = parseCalendarDate(
    `${period.year}-${String(period.month + 1).padStart(2, "0")}-01`,
  );
  const periodLabel = format.dateTime(periodLabelDate, {
    year: "numeric",
    month: "long",
  });

  const todayKey = todayCalendarDate();

  const emptyStateNode = (
    <Empty className="border-none py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ReceiptIcon />
        </EmptyMedia>
        <EmptyTitle>{t("table.empty.title")}</EmptyTitle>
        <EmptyDescription>{t("table.empty.description")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("description")}
        badge={
          <Badge variant="secondary">
            {t("header.subtitle", { count: invoices.length })}
          </Badge>
        }
        right={
          <PeriodStepper
            label={periodLabel}
            onPrevious={() =>
              setPeriod((current) => shiftInvoicePeriod(current, -1))
            }
            onNext={() =>
              setPeriod((current) => shiftInvoicePeriod(current, 1))
            }
            previousLabel={t("period.previous")}
            nextLabel={t("period.next")}
          />
        }
      />

      <KpiGrid>
        <KpiCard
          label={t("kpis.toPay")}
          value={money(toPay)}
          tone="warning"
          subtitle={t("kpis.toPayLegend", { count: toPayCount })}
        />
        <KpiCard
          label={t("kpis.open")}
          value={money(open)}
          subtitle={t("kpis.openLegend")}
        />
        <KpiCard
          label={t("kpis.partiallyPaid")}
          value={money(partiallyPaid)}
          tone="warning"
          subtitle={t("kpis.partiallyPaidLegend", { count: partiallyPaidCount })}
        />
        <KpiCard
          label={t("kpis.paid")}
          value={money(paid)}
          tone="positive"
          subtitle={t("kpis.paidLegend", { count: paidCount })}
        />
        <KpiCard
          label={t("kpis.total")}
          value={money(total)}
          subtitle={t("kpis.totalLegend")}
        />
      </KpiGrid>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={searchText}
          onChange={setSearchText}
          placeholder={t("search.placeholder")}
          clearLabel={t("search.clear")}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={accountId ?? ALL_VALUE}
            onValueChange={(value) =>
              setAccountId(value === ALL_VALUE ? undefined : value)
            }>
            <SelectTrigger className="h-8 w-55">
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

          <ToggleGroup
            type="single"
            variant="tabs"
            size="sm"
            value={statusFilter}
            onValueChange={(value) => {
              if (value) setStatusFilter(value as StatusFilter);
            }}>
            <ToggleGroupItem value="all">{t("status.all")}</ToggleGroupItem>
            <ToggleGroupItem value="CLOSED">
              {t("status.closed")}
            </ToggleGroupItem>
            <ToggleGroupItem value="OPEN">{t("status.open")}</ToggleGroupItem>
            <ToggleGroupItem value="PARTIALLY_PAID">
              {t("status.partiallyPaid")}
            </ToggleGroupItem>
            <ToggleGroupItem value="PAID">{t("status.paid")}</ToggleGroupItem>
          </ToggleGroup>

          <ViewModeToggle
            value={viewMode}
            onValueChange={setViewMode}
            cardsLabel={t("viewMode.grid")}
            listLabel={t("viewMode.table")}
          />
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="rounded-md border border-border">{emptyStateNode}</div>
      ) : viewMode === "list" ? (
        <DataTable
          columns={columns}
          data={filteredInvoices}
          emptyState={emptyStateNode}
          getRowId={(row) => row.id}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredInvoices.map((invoice) => {
            const color = getAccountColorClasses(invoice.accountId);
            const canPay = canPayInvoice(invoice.displayStatus);
            const dueHint = getDueHint(
              invoice.displayStatus,
              dateOnlyKey(invoice.closingDate),
              dateOnlyKey(invoice.dueDate),
              todayKey,
            );
            const dueHintText =
              dueHint.kind === "paid" && invoice.paidAt
                ? t("card.dueHint.paidOn", {
                    date: format.dateTime(
                      invoice.paidAt,
                      DATE_ONLY_FORMAT_OPTIONS,
                    ),
                  })
                : dueHint.kind === "closesToday"
                  ? t("card.dueHint.closesToday")
                  : dueHint.kind === "closesInDays"
                    ? t("card.dueHint.closesInDays", { days: dueHint.days })
                    : dueHint.kind === "dueToday"
                      ? t("card.dueHint.dueToday")
                      : dueHint.kind === "dueInDays"
                        ? t("card.dueHint.dueInDays", { days: dueHint.days })
                        : dueHint.kind === "overdueDays"
                          ? t("card.dueHint.overdueDays", {
                              days: dueHint.days,
                            })
                          : null;
            const dueHintClass =
              dueHint.kind === "dueToday" || dueHint.kind === "overdueDays"
                ? "text-negative"
                : "text-muted-foreground";

            return (
              <Card key={invoice.id} radius="lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-base">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        color.bg,
                      )}>
                      <CreditCardIcon
                        weight="fill"
                        className={cn("size-5", color.icon)}
                      />
                    </span>
                    {invoice.account.name}
                  </CardTitle>
                  <CardAction>
                    <InvoiceStatusBadge
                      status={invoice.displayStatus}
                      label={statusLabel(invoice.displayStatus)}
                    />
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
                    <span className="text-xs text-muted-foreground">
                      {invoice.displayStatus === "PARTIALLY_PAID"
                        ? t("detail.summary.remainingDue")
                        : t("card.valueLabel")}
                    </span>
                    <span className="text-2xl font-bold tabular-nums text-negative">
                      {money(
                        invoice.displayStatus === "PARTIALLY_PAID"
                          ? invoice.remainingDue
                          : invoice.total,
                      )}
                    </span>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <ReceiptIcon className="size-3.5" />
                        {t("card.itemsCount", {
                          count: invoice.transactionCount,
                        })}
                      </span>
                      {dueHintText ? (
                        <span className={cn("font-medium", dueHintClass)}>
                          {dueHintText}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-0.5 rounded-lg border border-border p-2">
                      <span className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                        <LockIcon className="size-3" />
                        {t("card.closing")}
                      </span>
                      <span className="text-sm font-medium">
                        {format.dateTime(
                          invoice.closingDate,
                          DATE_ONLY_FORMAT_OPTIONS,
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 rounded-lg border border-border p-2">
                      <span className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                        <CalendarIcon className="size-3" />
                        {t("card.due")}
                      </span>
                      <span className="text-sm font-medium">
                        {format.dateTime(
                          invoice.dueDate,
                          DATE_ONLY_FORMAT_OPTIONS,
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter
                  className={cn(
                    "grid gap-2",
                    canPay ? "grid-cols-2" : "grid-cols-1",
                  )}>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/invoices/${invoice.id}`}>
                      {t("card.viewItems")}
                    </Link>
                  </Button>
                  {canPay ? (
                    <Button size="sm" onClick={() => setPayingInvoice(invoice)}>
                      {t("card.pay")}
                    </Button>
                  ) : null}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {payingInvoice ? (
        <PayInvoiceDialog
          open={payingInvoice !== null}
          onOpenChange={(open) => {
            if (!open) setPayingInvoice(null);
          }}
          invoiceId={payingInvoice.id}
          remainingDue={payingInvoice.remainingDue}
          accounts={payableAccounts}
          onPaid={handlePaid}
        />
      ) : null}
    </div>
  );
}
