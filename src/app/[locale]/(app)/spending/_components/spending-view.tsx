"use client";

import { createElement, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CaretRightIcon, ChartBarIcon } from "@phosphor-icons/react";
import { PageHeader, PeriodStepper } from "@/components/screen/page-header";
import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { APP_TIME_ZONE, parseCalendarDate } from "@/lib/date";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { resolveCategoryColorClasses } from "@/lib/category-color";
import {
  currentPeriod,
  periodRange,
  periodsEqual,
  shiftPeriod,
  type Period,
} from "../../transactions/_lib/period";
import { accountIdForKind } from "../../transactions/_lib/account-kind";
import { useSpendingData } from "../_hooks/use-spending-data";
import type { AccountKind, CategoryBreakdown } from "../_types/types";

type SpendingViewProps = {
  initialBreakdown: CategoryBreakdown;
};

const INITIAL_ACCOUNT_KIND: AccountKind = "debit";

export function SpendingView({ initialBreakdown }: SpendingViewProps) {
  const t = useTranslations("scrn-spending");
  const format = useFormatter();

  const [initialPeriod] = useState(() => currentPeriod());
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [accountKind, setAccountKind] = useState<AccountKind>(INITIAL_ACCOUNT_KIND);

  const { from, to } = useMemo(() => periodRange(period), [period]);
  const accountId = accountIdForKind(accountKind);

  const isDefaultFilters =
    periodsEqual(period, initialPeriod) && accountKind === INITIAL_ACCOUNT_KIND;

  const { breakdown } = useSpendingData({
    from,
    to,
    accountId,
    accountKind,
    initialBreakdown,
    useInitialData: isDefaultFilters,
  });

  const periodStartDate = useMemo(() => parseCalendarDate(from), [from]);
  const periodLabel = format.dateTime(periodStartDate, {
    month: "long",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  });

  const items = breakdown?.items ?? [];
  const totalExpenses = breakdown?.totalExpenses ?? 0;

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("description")} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodStepper
          label={periodLabel}
          onPrevious={() => setPeriod((current) => shiftPeriod(current, -1))}
          onNext={() => setPeriod((current) => shiftPeriod(current, 1))}
          previousLabel={t("period.previous")}
          nextLabel={t("period.next")}
        />
        <ToggleGroup
          type="single"
          variant="tabs"
          value={accountKind}
          onValueChange={(value) => {
            if (value) setAccountKind(value as AccountKind);
          }}
        >
          <ToggleGroupItem value="debit">{t("tabs.debit")}</ToggleGroupItem>
          <ToggleGroupItem value="credit">{t("tabs.credit")}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <KpiGrid columns={2}>
        <KpiCard label={t("kpis.total")} value={money(totalExpenses)} tone="negative" />
        <KpiCard label={t("kpis.categoriesCount")} value={items.length} />
      </KpiGrid>

      {items.length === 0 ? (
        <Empty className="rounded-md border border-dashed border-border py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ChartBarIcon />
            </EmptyMedia>
            <EmptyTitle>{t("empty.title")}</EmptyTitle>
            <EmptyDescription>{t("empty.description")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-md border border-border">
          <div className="divide-y divide-border">
            {items.map((item) => (
              <CategoryRow
                key={item.id}
                item={item}
                share={totalExpenses > 0 ? item.total / totalExpenses : 0}
                month={from.slice(0, 7)}
                accountId={accountId}
                money={money}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  item,
  share,
  month,
  accountId,
  money,
}: {
  item: CategoryBreakdown["items"][number];
  share: number;
  month: string;
  accountId: string;
  money: (value: number) => string;
}) {
  const t = useTranslations("scrn-spending");
  const format = useFormatter();
  const color = resolveCategoryColorClasses(item.colorStyle);
  const Icon = resolveCategoryIcon(item.icon);

  // The synthetic "uncategorized" bucket has no real Category to filter
  // transactions by — same reasoning as the account detail screen's own
  // unattributed row (accounts/[id]/_components/account-detail-view.tsx):
  // no link target, so it renders as plain text instead.
  const isUncategorized = item.id === "uncategorized";

  const content = (
    <>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          color.badge,
        )}
      >
        {createElement(Icon, { className: "size-4.5" })}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium">{item.name}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {money(item.total)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", color.bar)}
              style={{ width: `${share * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {format.number(share, { style: "percent", maximumFractionDigits: 0 })}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {t("transactionsCount", { count: item.transactionsCount })}
        </span>
      </div>
    </>
  );

  if (isUncategorized) {
    return <div className="flex items-center gap-3 px-3 py-3">{content}</div>;
  }

  return (
    <Link
      href={{
        pathname: "/transactions",
        query: { month, category: item.id, account: accountId },
      }}
      aria-label={t("viewTransactions", { name: item.name })}
      className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/50"
    >
      {content}
      <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
