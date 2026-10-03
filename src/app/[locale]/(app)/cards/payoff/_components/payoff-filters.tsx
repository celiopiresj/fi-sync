"use client";

import { useFormatter, useTranslations } from "next-intl";
import { PeriodStepper } from "@/components/screen/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ALL_VALUE } from "../_constants/constants";
import { formatMonthLong } from "../_lib/format-payoff";
import { shiftMonthKey } from "../_lib/payoff-month";
import { payoffScopeValues, type PayoffScope } from "../_schema/schema";
import type { CardPayoffOptions } from "../_types/types";
import { PeopleFilter } from "./people-filter";

type PayoffFiltersProps = {
  options: CardPayoffOptions;
  accountId: string | undefined;
  onAccountChange: (accountId: string | undefined) => void;
  personIds: string[];
  onPeopleChange: (personIds: string[]) => void;
  scope: PayoffScope;
  onScopeChange: (scope: PayoffScope) => void;
  // The window in use and how far it can move (CardPayoff's own
  // fromMonth/firstMonth/lastMonth) — null when nothing is owed at all,
  // which hides the stepper.
  fromMonth: string | null;
  firstMonth: string | null;
  lastMonth: string | null;
  onFromMonthChange: (monthKey: string) => void;
};

export function PayoffFilters({
  options,
  accountId,
  onAccountChange,
  personIds,
  onPeopleChange,
  scope,
  onScopeChange,
  fromMonth,
  firstMonth,
  lastMonth,
  onFromMonthChange,
}: PayoffFiltersProps) {
  const t = useTranslations("scrn-card-payoff");
  const format = useFormatter();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={accountId ?? ALL_VALUE}
          onValueChange={(value) => onAccountChange(value === ALL_VALUE ? undefined : value)}
        >
          <SelectTrigger className="h-8 w-full sm:w-55" aria-label={t("filters.card")}>
            <SelectValue placeholder={t("filters.card")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{t("filters.allCards")}</SelectItem>
            {options.cards.map((card) => (
              <SelectItem key={card.id} value={card.id}>
                {card.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <PeopleFilter people={options.people} value={personIds} onChange={onPeopleChange} />

        <ToggleGroup
          type="single"
          variant="tabs"
          value={scope}
          onValueChange={(value) => {
            if (value) onScopeChange(value as PayoffScope);
          }}
          aria-label={t("filters.scope.label")}
        >
          {payoffScopeValues.map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {t(`filters.scope.${value}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {fromMonth && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm text-muted-foreground">{t("filters.from.label")}</span>
          <PeriodStepper
            label={formatMonthLong(format, fromMonth)}
            onPrevious={() => onFromMonthChange(shiftMonthKey(fromMonth, -1))}
            onNext={() => onFromMonthChange(shiftMonthKey(fromMonth, 1))}
            previousLabel={t("filters.from.previous")}
            nextLabel={t("filters.from.next")}
            previousDisabled={firstMonth === null || fromMonth <= firstMonth}
            nextDisabled={lastMonth === null || fromMonth >= lastMonth}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t(`hint.${scope}`)}</p>
    </div>
  );
}
