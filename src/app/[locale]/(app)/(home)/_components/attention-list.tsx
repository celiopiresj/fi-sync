"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/screen/section-card";
import { cn } from "@/lib/utils";
import {
  ArrowsClockwiseIcon,
  ChartPieSliceIcon,
  CheckCircleIcon,
  CreditCardIcon,
  ReceiptIcon,
} from "@phosphor-icons/react";
import { ATTENTION_TONE_BADGE } from "../_constants/constants";
import { useHomeMoney } from "../_hooks/use-home-money";
import type { HomeOverview } from "../_types/types";

type Tone = keyof typeof ATTENTION_TONE_BADGE;

type AttentionListProps = {
  attention: HomeOverview["attention"];
  balancesVisible?: boolean;
};

export function AttentionList({ attention, balancesVisible = true }: AttentionListProps) {
  const t = useTranslations("scrn-home");
  const money = useHomeMoney(balancesVisible);

  const rows = (
    [
      attention.closedInvoicesCount > 0
        ? {
            key: "closedInvoices",
            tone: "warning" as Tone,
            icon: ReceiptIcon,
            title: t("attention.closedInvoices", { count: attention.closedInvoicesCount }),
            details: [
              t("attention.closedInvoicesDetail", {
                value: money(attention.closedInvoicesTotal),
              }),
            ],
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
            details: attention.highUsageCards.map(
              (card) => `${card.name} (${Math.round(card.usagePercent)}%)`,
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
            details: attention.overBudgetCategories.map(
              (category) => `${category.name} (+${money(category.overAmount)})`,
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
            details: attention.recurrencesNeedingExtension.map(
              (recurrence) => recurrence.description,
            ),
            actionLabel: t("attention.generate"),
            href: "/recurrences",
          }
        : null,
    ] as const
  ).filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <SectionCard
      title={t("attention.title")}
      action={
        rows.length > 0 ? (
          <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
            {t("attention.count", { count: rows.length })}
          </Badge>
        ) : null
      }
    >

      {rows.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircleIcon className="size-4 text-positive" />
          {t("attention.empty")}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              {/* Phones: text on its own line, the button underneath (at
                  most two items per line, see AGENTS.md). */}
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    ATTENTION_TONE_BADGE[row.tone],
                  )}
                >
                  <row.icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{row.title}</span>
                  {/* One item per line, never cut off with an ellipsis. */}
                  <ul className="flex flex-col text-xs text-muted-foreground">
                    {row.details.map((detail) => (
                      <li key={detail} className="break-words">
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="w-full shrink-0 sm:w-auto">
                <Link href={row.href}>{row.actionLabel}</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
