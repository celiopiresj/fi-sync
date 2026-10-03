"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CaretDownIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PickerSearchInput } from "@/components/form/picker-search-input";
import { matchesPersonQuery, togglePersonId } from "../_lib/people-filter";
import type { CardPayoffOptions } from "../_types/types";

type PeopleFilterProps = {
  people: CardPayoffOptions["people"];
  // Empty = "Todas as pessoas".
  value: string[];
  onChange: (personIds: string[]) => void;
};

// Pick any number of people — the screen then sums just their shares.
// Each tick applies right away (no "Aplicar" step), like the card Select
// beside it.
export function PeopleFilter({ people, value, onChange }: PeopleFilterProps) {
  const t = useTranslations("scrn-card-payoff");
  const tCommon = useTranslations("common");
  const [query, setQuery] = useState("");

  const visiblePeople = people.filter((person) => matchesPersonQuery(person.name, query));
  const singlePerson =
    value.length === 1 ? people.find((person) => person.id === value[0]) : undefined;

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={t("filters.person")}
          className="h-8 w-full justify-between font-normal sm:w-55"
        >
          <span className="truncate">
            {value.length === 0
              ? t("filters.allPeople")
              : (singlePerson?.name ?? t("filters.peopleCount", { count: value.length }))}
          </span>
          <CaretDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <PickerSearchInput
          value={query}
          onChange={setQuery}
          placeholder={tCommon("picker.searchPlaceholder")}
          clearLabel={tCommon("picker.searchClear")}
        />
        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {query.trim() === "" && (
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <Checkbox
                checked={value.length === 0}
                onCheckedChange={() => onChange([])}
                aria-label={t("filters.allPeople")}
              />
              {t("filters.allPeople")}
            </label>
          )}
          {visiblePeople.map((person) => (
            <label
              key={person.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={value.includes(person.id)}
                onCheckedChange={() => onChange(togglePersonId(value, person.id))}
                aria-label={person.name}
              />
              <span className="truncate">{person.name}</span>
            </label>
          ))}
          {visiblePeople.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {tCommon("picker.noResults")}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
