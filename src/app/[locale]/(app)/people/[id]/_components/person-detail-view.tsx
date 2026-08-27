"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { ArrowLeftIcon, ReceiptIcon, WhatsappLogoIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { DATE_ONLY_FORMAT_OPTIONS, parseCalendarDate } from "@/lib/date";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PeriodStepper } from "@/components/screen/page-header";
import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import { getPersonColorClasses, getPersonInitial } from "../../_lib/person-avatar";
import { joinPersonPhone } from "../../_lib/phone";
import {
  currentStatementPeriod,
  shiftStatementPeriod,
} from "../../_lib/cash-cycle";
import { usePersonStatement } from "../_hooks/use-person-statement";
import { buildWhatsAppLink } from "../../_lib/whatsapp-message";
import { buildPersonStatementMessage } from "../../_lib/statement-message";
import { WhatsAppPreviewDialog } from "../../_components/whatsapp-preview-dialog";
import type { PersonStatement, StatementPeriod } from "../_types/types";

type PersonDetailViewProps = {
  personId: string;
  initialStatement: NonNullable<PersonStatement>;
};

export function PersonDetailView({
  personId,
  initialStatement,
}: PersonDetailViewProps) {
  const t = useTranslations("scrn-people");
  const format = useFormatter();

  const [period, setPeriod] = useState<StatementPeriod>(() =>
    currentStatementPeriod(),
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: statement } = usePersonStatement(
    personId,
    period,
    initialStatement,
  );

  const money = (value: number) =>
    format.number(value, { style: "currency", currency: "BRL" });

  const periodLabelDate = parseCalendarDate(
    `${period.year}-${String(period.month + 1).padStart(2, "0")}-01`,
  );
  const periodLabel = format.dateTime(periodLabelDate, {
    year: "numeric",
    month: "long",
  });

  const isTotalOwedByUser = statement ? statement.totalToSettle >= 0 : true;
  const totalTitleKey = isTotalOwedByUser
    ? "detail.summary.totalToPay"
    : "detail.summary.totalToReceive";
  const totalLegendKey = isTotalOwedByUser
    ? "detail.summary.totalToPayLegend"
    : "detail.summary.totalToReceiveLegend";

  // Only unpaid invoices count as "pending" — a paid one's items already
  // rolled into `statement.balance` (see getPersonStatement in
  // actions.ts), so surfacing them again here would double them up.
  const pendingCardSections =
    statement?.cardSections.filter((section) => !section.isPaid) ?? [];

  const movementsRangeLabel = statement
    ? t(
        statement.cashCycle.isOpen
          ? "detail.movements.rangeOpen"
          : "detail.movements.rangeClosed",
        {
          from: format.dateTime(statement.cashCycle.start, {
            day: "2-digit",
            month: "2-digit",
          }),
          to: format.dateTime(statement.cashCycle.end, {
            day: "2-digit",
            month: "2-digit",
          }),
        },
      )
    : "";

  const message = statement
    ? buildPersonStatementMessage(statement, period, t, format)
    : "";

  if (!statement) return null;

  const phone = joinPersonPhone(
    statement.person.phoneCountryCode,
    statement.person.phone,
  );
  const color = getPersonColorClasses(statement.person.name);
  const whatsappLink = buildWhatsAppLink(
    statement.person.phoneCountryCode,
    statement.person.phone,
    message,
  );

  function handleWhatsAppClick() {
    if (!whatsappLink) {
      toast.error(t("detail.whatsapp.noPhoneToast"));
      return;
    }
    setPreviewOpen(true);
  }

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <Link
        href="/people"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("detail.back")}
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback className={cn(color.bg, color.text)}>
              {getPersonInitial(statement.person.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-lg font-semibold">{statement.person.name}</span>
            {phone ? (
              <span className="text-sm text-muted-foreground">{phone}</span>
            ) : null}
          </div>
        </div>
        <Button onClick={handleWhatsAppClick} title={whatsappLink ? undefined : t("detail.header.noPhone")}>
          <WhatsappLogoIcon weight="fill" />
          {t("detail.header.whatsappButton")}
        </Button>
      </div>

      <PeriodStepper
        className="justify-center"
        label={periodLabel}
        onPrevious={() => setPeriod((current) => shiftStatementPeriod(current, -1))}
        onNext={() => setPeriod((current) => shiftStatementPeriod(current, 1))}
        previousLabel={t("detail.period.previous")}
        nextLabel={t("detail.period.next")}
      />

      <KpiGrid>
        <KpiCard
          label={t("detail.summary.balance")}
          value={money(statement.balance)}
        />
        <KpiCard
          label={t("detail.summary.invoice")}
          value={money(Math.abs(statement.pendingCardTotal))}
        />
        <KpiCard
          label={t("detail.summary.paidThisMonth")}
          value={money(statement.paidThisMonth)}
        />
        <KpiCard
          label={t(totalTitleKey)}
          value={money(Math.abs(statement.totalToSettle))}
          tone={isTotalOwedByUser ? "negative" : "positive"}
          subtitle={t(totalLegendKey)}
        />
      </KpiGrid>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">{t("detail.movements.title")}</h2>
          <span className="text-xs text-muted-foreground">
            {movementsRangeLabel}
          </span>
        </div>

        {statement.movements.length === 0 ? (
          <Empty className="border-none py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ReceiptIcon />
              </EmptyMedia>
              <EmptyTitle>{t("detail.movements.empty")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="rounded-md border border-border">
            <div className="divide-y divide-border">
              {statement.movements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {movement.description}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format.dateTime(movement.date, DATE_ONLY_FORMAT_OPTIONS)}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-medium tabular-nums",
                      movement.amount >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {money(movement.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {pendingCardSections.map((section) => (
        <div key={section.accountId} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium">{section.accountName}</h2>
            <span className="text-xs text-muted-foreground">
              {t("detail.invoices.title", { month: periodLabel })}
            </span>
          </div>

          <div className="rounded-md border border-border">
            <div className="divide-y divide-border">
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {item.description}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format.dateTime(item.date, DATE_ONLY_FORMAT_OPTIONS)} ·{" "}
                      {item.installmentCount && item.installmentCount > 1
                        ? t("detail.invoices.installment", {
                            number: item.installmentNumber ?? 0,
                            count: item.installmentCount,
                          })
                        : t("detail.invoices.cash")}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-negative">
                    {money(Math.abs(item.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {whatsappLink ? (
        <WhatsAppPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          message={message}
          whatsappLink={whatsappLink}
        />
      ) : null}
    </div>
  );
}
