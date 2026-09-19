"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  ArrowLeftIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CreditCardIcon,
  HandCoinsIcon,
  ReceiptIcon,
  TrendUpIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { DATE_ONLY_FORMAT_OPTIONS } from "@/lib/date";
import { capitalizeFirst } from "@/lib/capitalize-first";
import { monthKeyToDate } from "../_lib/projection-month";
import { RISK_BADGE_CLASS, RISK_TEXT_CLASS } from "../_lib/risk-status-style";
import type { ProjectionDetail } from "../_types/types";

type ProjectionDetailViewProps = {
  detail: ProjectionDetail;
};

export function ProjectionDetailView({ detail }: ProjectionDetailViewProps) {
  const t = useTranslations("scrn-projections");
  const format = useFormatter();

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }
  // Invoice.dueDate/Transaction.date are @db.Date columns — DATE_ONLY_
  // FORMAT_OPTIONS (timeZone: "UTC"), never the app's default
  // APP_TIME_ZONE-based formatting, per src/lib/date.ts's own note on
  // why those two cases need different handling.
  function shortDate(date: Date) {
    return format.dateTime(date, DATE_ONLY_FORMAT_OPTIONS);
  }

  const monthLabel = capitalizeFirst(
    format.dateTime(monthKeyToDate(detail.monthKey), {
      month: "long",
      year: "numeric",
    }),
  );

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href="/projections" aria-label={t("detail.back")}>
              <ArrowLeftIcon />
            </Link>
          </Button>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">
                {t("detail.title", { month: monthLabel })}
              </h1>
              <Badge
                variant="outline"
                className={cn("w-fit", RISK_BADGE_CLASS[detail.status])}
              >
                {detail.status === "ok" ? (
                  <CheckCircleIcon />
                ) : (
                  <WarningCircleIcon />
                )}
                {t(`detail.statusBadge.${detail.status}`)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("detail.subtitle")}
            </p>
          </div>
        </div>

        {(detail.previousMonthId || detail.nextMonthId) && (
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="outline" size="icon-sm" asChild disabled={!detail.previousMonthId}>
              {detail.previousMonthId ? (
                <Link
                  href={`/projections/${detail.previousMonthId}`}
                  aria-label={t("detail.nav.previous")}
                >
                  <CaretLeftIcon className="size-4" />
                </Link>
              ) : (
                <span aria-hidden>
                  <CaretLeftIcon className="size-4" />
                </span>
              )}
            </Button>
            <Button variant="outline" size="icon-sm" asChild disabled={!detail.nextMonthId}>
              {detail.nextMonthId ? (
                <Link
                  href={`/projections/${detail.nextMonthId}`}
                  aria-label={t("detail.nav.next")}
                >
                  <CaretRightIcon className="size-4" />
                </Link>
              ) : (
                <span aria-hidden>
                  <CaretRightIcon className="size-4" />
                </span>
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t("detail.summary.initialBalance")}
            </span>
            <span className="text-xl font-semibold tabular-nums">
              {money(detail.initialBalance)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t("detail.summary.receivables")}
            </span>
            <span className="text-xl font-semibold tabular-nums text-positive">
              +{money(detail.incomeForecast)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t("detail.summary.totalExpenses")}
            </span>
            <span className="text-xl font-semibold tabular-nums text-negative">
              -{money(detail.totalExpenses)}
            </span>
          </CardContent>
        </Card>
        <Card
          className={cn(detail.status !== "ok" && "border-negative/30 bg-negative/5")}
        >
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t("detail.summary.predictedBalance")}
            </span>
            <span
              className={cn(
                "text-xl font-semibold tabular-nums",
                RISK_TEXT_CLASS[detail.status],
              )}
            >
              {money(detail.projectedBalance)}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <CreditCardIcon className="size-4 text-muted-foreground" />
                {t("detail.sections.cards.title")}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {money(detail.cardExpenses)}
              </span>
            </div>
            {detail.cardsBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("detail.sections.cards.empty")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {detail.cardsBreakdown.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-3"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-semibold">
                        {item.name}
                        {item.cardLastFourDigits
                          ? ` •••• ${item.cardLastFourDigits}`
                          : ""}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {t("detail.sections.cards.dueDate", {
                          date: shortDate(item.dueDate),
                        })}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">
                      {money(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ReceiptIcon className="size-4 text-muted-foreground" />
                {t("detail.sections.accounts.title")}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {money(detail.accountExpenses)}
              </span>
            </div>
            {detail.accountsBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("detail.sections.accounts.empty")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {detail.accountsBreakdown.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-3"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-semibold">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {t("detail.sections.accounts.dueDate", {
                          date: shortDate(item.date),
                        })}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">
                      {money(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <HandCoinsIcon className="size-4 text-muted-foreground" />
                {t("detail.sections.loans.title")}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {money(detail.loanExpenses)}
              </span>
            </div>
            {detail.loansBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("detail.sections.loans.empty")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {detail.loansBreakdown.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-3"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-semibold">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {t("detail.sections.loans.dueDate", {
                          date: shortDate(item.date),
                        })}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">
                      {money(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <TrendUpIcon className="size-4 text-positive" />
                {t("detail.sections.receivables.title")}
              </span>
              <span className="text-sm font-semibold tabular-nums text-positive">
                {money(detail.incomeForecast)}
              </span>
            </div>
            {detail.receivablesBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("detail.sections.receivables.empty")}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {detail.receivablesBreakdown.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-3"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-semibold">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {t("detail.sections.receivables.dueDate", {
                          date: shortDate(item.date),
                        })}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-positive">
                      +{money(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Link
        href={{
          pathname: "/transactions",
          query: {
            month: detail.monthKey,
            // Matches this page's own self-share filtering — without it
            // the linked list would show everyone's transactions for the
            // month, not just what was actually summed here.
            ...(detail.selfPersonId ? { person: detail.selfPersonId } : {}),
          },
        }}
        className="self-start text-xs font-medium text-primary hover:underline"
      >
        {t("detail.viewStatement")} →
      </Link>
    </div>
  );
}
