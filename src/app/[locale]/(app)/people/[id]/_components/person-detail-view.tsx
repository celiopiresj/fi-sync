"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeftIcon,
  CaretLeftIcon,
  CaretRightIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { DATE_ONLY_FORMAT_OPTIONS, parseCalendarDate } from "@/lib/date";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setPeriod((current) => shiftStatementPeriod(current, -1))}
          aria-label={t("detail.period.previous")}
        >
          <CaretLeftIcon />
        </Button>
        <span className="min-w-36 text-center text-sm font-medium capitalize">
          {periodLabel}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setPeriod((current) => shiftStatementPeriod(current, 1))}
          aria-label={t("detail.period.next")}
        >
          <CaretRightIcon />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {t("detail.summary.balance")}
            </span>
            <span className="text-xl font-semibold tabular-nums">
              {money(statement.balance)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {t("detail.summary.invoice")}
            </span>
            <span className="text-xl font-semibold tabular-nums">
              {money(Math.abs(statement.pendingCardTotal))}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {t("detail.summary.paidThisMonth")}
            </span>
            <span className="text-xl font-semibold tabular-nums">
              {money(statement.paidThisMonth)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t(totalTitleKey)}</span>
            <span
              className={cn(
                "text-xl font-semibold tabular-nums",
                isTotalOwedByUser ? "text-negative" : "text-positive",
              )}
            >
              {money(Math.abs(statement.totalToSettle))}
            </span>
            <span className="text-xs text-muted-foreground">
              {t(totalLegendKey)}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">{t("detail.movements.title")}</h2>
          <span className="text-xs text-muted-foreground">
            {movementsRangeLabel}
          </span>
        </div>

        {statement.movements.length === 0 ? (
          <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            {t("detail.movements.empty")}
          </p>
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
