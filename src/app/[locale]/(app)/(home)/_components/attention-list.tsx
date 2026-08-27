"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowsClockwiseIcon,
  ChartPieSliceIcon,
  CheckCircleIcon,
  CreditCardIcon,
  ReceiptIcon,
} from "@phosphor-icons/react";
import type { HomeOverview } from "../_types/types";

type Tone = "warning" | "negative" | "default";

const TONE_CARD: Record<Tone, string> = {
  warning: "bg-warning/10",
  negative: "bg-negative/10",
  default: "bg-muted/60",
};
const TONE_ICON: Record<Tone, string> = {
  warning: "text-warning",
  negative: "text-negative",
  default: "text-muted-foreground",
};

// "A, B e C" — same join every naturally-listed detail line below uses
// (card names, over-budget categories, recurrence titles).
function naturalJoin(items: string[], conjunction: string): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
}

type AttentionListProps = {
  attention: HomeOverview["attention"];
};

export function AttentionList({ attention }: AttentionListProps) {
  const t = useTranslations("scrn-home");
  const format = useFormatter();

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  const conjunction = t("attention.and");

  const rows = (
    [
      attention.closedInvoicesCount > 0
        ? {
            key: "closedInvoices",
            tone: "warning" as Tone,
            icon: ReceiptIcon,
            title: t("attention.closedInvoices", { count: attention.closedInvoicesCount }),
            detail: t("attention.closedInvoicesDetail", {
              value: money(attention.closedInvoicesTotal),
            }),
            actionLabel: t("attention.payNow"),
            href: "/invoices",
          }
        : null,
      attention.highUsageCards.length > 0
        ? {
            key: "highUsageCards",
            tone: "negative" as Tone,
            icon: CreditCardIcon,
            title: t("attention.highUsageCards", { count: attention.highUsageCards.length }),
            detail: naturalJoin(
              attention.highUsageCards.map(
                (card) => `${card.name} (${Math.round(card.usagePercent)}%)`,
              ),
              conjunction,
            ),
            actionLabel: t("attention.adjustLimit"),
            href: "/cards",
          }
        : null,
      attention.overBudgetCategories.length > 0
        ? {
            key: "overBudget",
            tone: "default" as Tone,
            icon: ChartPieSliceIcon,
            title: t("attention.overBudget", { count: attention.overBudgetCategories.length }),
            detail: naturalJoin(
              attention.overBudgetCategories.map(
                (category) => `${category.name} (+${money(category.overAmount)})`,
              ),
              conjunction,
            ),
            actionLabel: t("attention.viewBudget"),
            href: "/budgets",
          }
        : null,
      attention.recurrencesNeedingExtension.length > 0
        ? {
            key: "recurrencesNeedingExtension",
            tone: "default" as Tone,
            icon: ArrowsClockwiseIcon,
            title: t("attention.recurrencesNeedingExtension", {
              count: attention.recurrencesNeedingExtension.length,
            }),
            detail: naturalJoin(
              attention.recurrencesNeedingExtension.map((recurrence) => recurrence.description),
              conjunction,
            ),
            actionLabel: t("attention.generate"),
            href: "/recurrences",
          }
        : null,
    ] as const
  ).filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{t("attention.title")}</h2>
        {rows.length > 0 && (
          <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
            {t("attention.count", { count: rows.length })}
          </Badge>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircleIcon className="size-4 text-positive" />
          {t("attention.empty")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.key}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md px-3 py-2.5",
                TONE_CARD[row.tone],
              )}
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <row.icon className={cn("mt-0.5 size-4 shrink-0", TONE_ICON[row.tone])} />
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{row.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{row.detail}</span>
                </div>
              </div>
              <Button
                asChild
                size="sm"
                variant={
                  row.tone === "negative"
                    ? "destructive"
                    : row.tone === "warning"
                      ? "default"
                      : "outline"
                }
                className="shrink-0"
              >
                <Link href={row.href}>{row.actionLabel}</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
