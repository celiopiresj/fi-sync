"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { BankIcon, CreditCardIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { groupSources } from "../_lib/options";
import type { SourceStripProps } from "../_types/types";

export function SourceStrip({ sources, source, onSelect }: SourceStripProps) {
  const t = useTranslations("scrn-open-finance");
  return <nav aria-label={t("aria.sources")} className="-mx-1 flex min-w-0 items-stretch gap-2 overflow-x-auto px-1 pb-1">
    {groupSources(sources).filter((group) => group.sources.length > 0).map((group, index) => <Fragment key={group.type}>
      {index > 0 && <span aria-hidden="true" className="mx-1 w-px shrink-0 self-stretch bg-border" />}
      <span className="shrink-0 self-center px-1 text-xs font-semibold tracking-wide text-muted-foreground">{t(`cards.sidebar.${group.title}`)}</span>
      {group.sources.map((entry) => {
        const selected = source?.id === entry.id;
        return <Button key={entry.id} type="button" variant="outline" aria-pressed={selected} className={cn("h-auto shrink-0 justify-start gap-2.5 rounded-lg py-2 pr-3 pl-2 text-left", selected && "border-primary bg-primary/5 ring-2 ring-primary/10")} onClick={() => onSelect(entry.id)}>
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground", selected && "bg-primary/10 text-primary")}>{group.type === "CREDIT" ? <CreditCardIcon className="size-4.5" /> : <BankIcon className="size-4.5" />}</span>
          <span className="flex max-w-56 flex-col"><span className="truncate text-sm font-semibold">{entry.name}</span><span className="truncate text-xs font-normal text-muted-foreground">{entry.bankLabel}</span></span>
        </Button>;
      })}
    </Fragment>)}
  </nav>;
}
