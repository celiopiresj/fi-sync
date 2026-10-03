"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCardIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/screen/page-header";
import { DataTable } from "@/components/data-table/data-table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { DEFAULT_SCOPE } from "../_constants/constants";
import { useCardPayoffData } from "../_hooks/use-card-payoff-data";
import type { CardPayoffFilters, PayoffScope } from "../_schema/schema";
import type { CardPayoff, CardPayoffOptions } from "../_types/types";
import { PayoffFilters } from "./payoff-filters";
import { PayoffKpis } from "./payoff-kpis";
import { PayoffMonthsCard } from "./payoff-months-card";
import { PayoffBreakdownCard } from "./payoff-breakdown-card";
import { getPayoffColumns } from "./table/columns";
import { PayoffMobileList } from "./table/payoff-mobile-list";

type CardPayoffViewProps = {
  options: CardPayoffOptions;
  initialPayoff: CardPayoff;
};

export function CardPayoffView({ options, initialPayoff }: CardPayoffViewProps) {
  const t = useTranslations("scrn-card-payoff");

  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [scope, setScope] = useState<PayoffScope>(DEFAULT_SCOPE);
  // Unset until the user moves the stepper — the server then starts from
  // the earliest invoice still owing anything for the current filters.
  const [fromMonth, setFromMonth] = useState<string | undefined>(undefined);

  const filters: CardPayoffFilters = useMemo(
    () => ({ accountId, personIds, scope, fromMonth }),
    [accountId, personIds, scope, fromMonth],
  );
  // page.tsx fetched exactly this (no filters) for initialPayoff.
  const isDefaultFilters =
    !accountId && personIds.length === 0 && scope === DEFAULT_SCOPE && !fromMonth;

  const { payoff, isFetching } = useCardPayoffData(
    filters,
    initialPayoff,
    isDefaultFilters,
  );

  // Narrowed to exactly one person, the per-person views (the "Pessoas"
  // column, the "Por pessoa" card, the self/others split) would only
  // repeat that one name — they're dropped then.
  const singlePersonName =
    personIds.length === 1
      ? (options.people.find((person) => person.id === personIds[0])?.name ?? null)
      : null;
  const showPeople = singlePersonName === null;
  // The months card spans the whole row once neither side card applies.
  const hasSideCards = showPeople || !accountId;

  const columns = useMemo(
    () =>
      getPayoffColumns(
        {
          purchase: t("table.columns.purchase"),
          people: t("table.columns.people"),
          installments: t("table.columns.installments"),
          installmentAmount: t("table.columns.installmentAmount"),
          lastMonth: t("table.columns.lastMonth"),
          remaining: t("table.columns.remaining"),
        },
        { showPeople },
      ),
    [t, showPeople],
  );

  const emptyStateNode = (
    <Empty className="border-none py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CreditCardIcon />
        </EmptyMedia>
        <EmptyTitle>{t("table.empty.title")}</EmptyTitle>
        <EmptyDescription>{t("table.empty.description")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("description")} />

      <PayoffFilters
        options={options}
        accountId={accountId}
        onAccountChange={setAccountId}
        personIds={personIds}
        onPeopleChange={setPersonIds}
        scope={scope}
        onScopeChange={setScope}
        // The month the user picked wins over the one in the last result
        // — stepping twice before the first refetch lands must still
        // move two months, not recompute from the stale result twice.
        fromMonth={fromMonth ?? payoff.fromMonth}
        firstMonth={payoff.firstMonth}
        lastMonth={payoff.lastMonth}
        onFromMonthChange={setFromMonth}
      />

      <div
        aria-busy={isFetching}
        className={cn("flex flex-col gap-6 transition-opacity", isFetching && "opacity-60")}
      >
        <PayoffKpis
          payoff={payoff}
          singlePersonName={singlePersonName}
          selectedCount={personIds.length}
        />

        {payoff.months.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-3">
            <PayoffMonthsCard
              months={payoff.months}
              className={hasSideCards ? "lg:col-span-2" : "lg:col-span-3"}
            />
            {hasSideCards && (
              <div className="flex flex-col gap-6">
                {showPeople && (
                  <PayoffBreakdownCard
                    title={t("breakdown.people")}
                    rows={payoff.people.map((person) => ({
                      key: person.personId,
                      label: person.name,
                      total: person.total,
                      highlight: person.isSelf,
                    }))}
                  />
                )}
                {!accountId && (
                  <PayoffBreakdownCard
                    title={t("breakdown.cards")}
                    rows={payoff.cards.map((card) => ({
                      key: card.cardId,
                      label: card.name,
                      total: card.total,
                    }))}
                  />
                )}
              </div>
            )}
          </div>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("table.title")}</h2>
          <div className="hidden min-[700px]:block">
            <DataTable
              columns={columns}
              data={payoff.items}
              emptyState={emptyStateNode}
              getRowId={(row) => row.key}
            />
          </div>
          <div className="block min-[700px]:hidden">
            <PayoffMobileList items={payoff.items} emptyState={emptyStateNode} />
          </div>
        </section>
      </div>
    </div>
  );
}
