"use client";

import { useTranslations } from "next-intl";
import { BankIcon, CaretDownIcon, CheckIcon, CreditCardIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchInput } from "@/components/screen/search-input";
import { cn } from "@/lib/utils";
import { useSourcePicker } from "../_hooks/use-source-picker";
import { sourceDestination } from "../_lib/options";
import type { SourcePickerProps } from "../_types/types";

// One button with the current source; the list opens below it with a
// search fixed on top and only the list scrolling, so any number of
// connected accounts and cards fits without a horizontal strip.
export function SourcePicker({ sources, source, accounts, onSelect }: SourcePickerProps) {
  const t = useTranslations("scrn-open-finance");
  const picker = useSourcePicker({ sources, accounts, onSelect });
  return <Popover open={picker.open} onOpenChange={picker.changeOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" aria-label={t("fields.source.label")} className="h-auto w-full min-w-0 justify-start gap-2.5 rounded-lg bg-background py-1.5 pr-2.5 pl-1.5 text-left sm:w-85 data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/15">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{source.type === "CREDIT" ? <CreditCardIcon className="size-4.5" /> : <BankIcon className="size-4.5" />}</span>
        <span className="flex min-w-0 flex-1 flex-col"><span className="text-xs font-normal text-muted-foreground">{t("cards.source.picker")}</span><span className="truncate text-sm font-semibold">{source.name}</span></span>
        <CaretDownIcon className="shrink-0 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="flex max-h-[min(28rem,60vh)] w-[min(25rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0">
      <div className="shrink-0 border-b p-2">
        <SearchInput value={picker.query} onChange={picker.setQuery} placeholder={t("cards.source.search")} clearLabel={t("filters.clear")} />
      </div>
      <div role="listbox" aria-label={t("fields.source.label")} className="min-h-0 flex-1 overflow-y-auto p-2">
        {picker.groups.length === 0 && <p className="px-2 py-4 text-center text-sm text-muted-foreground">{t("cards.source.searchEmpty")}</p>}
        {picker.groups.map((group) => <div key={group.type} role="group" aria-label={t(`cards.sidebar.${group.title}`)} className="flex flex-col">
          <span className="flex justify-between px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground"><span>{t(`cards.sidebar.${group.title}`)}</span><span>{group.sources.length}</span></span>
          {group.sources.map((entry) => {
            const selected = entry.id === source.id;
            const account = sourceDestination(entry, accounts).account;
            return <button key={entry.id} type="button" role="option" aria-selected={selected} onClick={() => picker.choose(entry.id)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50">
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground", selected && "bg-primary/10 text-primary")}>{group.type === "CREDIT" ? <CreditCardIcon className="size-4" /> : <BankIcon className="size-4" />}</span>
              <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-sm font-medium">{entry.name}</span><span className="truncate text-xs text-muted-foreground">{entry.bankLabel}</span></span>
              <span className="max-w-32 shrink-0 truncate text-xs text-muted-foreground">{account ? t("cards.source.destination", { account: account.name }) : t("cards.mapping.unmapped")}</span>
              <CheckIcon className={cn("size-4 shrink-0 text-primary", !selected && "invisible")} />
            </button>;
          })}
        </div>)}
      </div>
    </PopoverContent>
  </Popover>;
}
