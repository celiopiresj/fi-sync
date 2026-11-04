"use client";

import { useFormatter, useTranslations } from "next-intl";
import { ArrowRightIcon, CheckIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { PreviewPanelProps } from "../_types/types";

// Floats over the bottom of the list only while something is selected, in
// inverted colors so it reads as a separate layer above the rows. On
// phones it sits above the tab bar and the floating add button.
export function SelectionBar({ preview }: PreviewPanelProps) {
  const t = useTranslations("scrn-open-finance");
  const formatter = useFormatter();
  if (preview.selectedCount === 0) return null;
  return <div role="region" aria-label={t("aria.selection")} className="sticky bottom-26 z-30 mx-auto flex w-full max-w-190 flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl bg-foreground py-2.5 pr-3 pl-4.5 text-background shadow-2xl md:bottom-4">
    <span className="mr-auto flex flex-wrap items-baseline gap-x-3.5 gap-y-1 text-sm">
      <span className="font-semibold">{t("table.selection.selected", { count: preview.selectedCount })}</span>
      <span className="font-medium tabular-nums">{formatter.number(Number(preview.selectedTotal), { style: "currency", currency: "BRL" })}</span>
    </span>
    <Button type="button" variant="outline" size="sm" className="border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background dark:border-background/25 dark:bg-transparent dark:hover:bg-background/10" onClick={preview.clearSelection}>{t("table.selection.clear")}</Button>
    <Button type="button" variant="outline" size="sm" className="border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background dark:border-background/25 dark:bg-transparent dark:hover:bg-background/10" disabled={preview.marking} onClick={() => preview.setConfirmingExisting(true)}><CheckIcon />{t("table.selection.markExisting", { count: preview.selectedCount })}</Button>
    <Button type="button" size="sm" onClick={preview.reviewSelected}>{t("table.selection.review", { count: preview.selectedCount })}<ArrowRightIcon /></Button>
  </div>;
}
