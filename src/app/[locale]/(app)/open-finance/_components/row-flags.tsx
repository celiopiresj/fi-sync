"use client";

import { useTranslations } from "next-intl";
import { CheckCircleIcon } from "@phosphor-icons/react";
import type { RowFlagsProps } from "../_types/types";

export function RowFlags({ row }: RowFlagsProps) {
  const t = useTranslations("scrn-open-finance");
  if (row.status !== "PENDING" && !row.payment && row.amount !== null && !row.existing) return null;
  return <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
    {row.existing && <span className="inline-flex min-w-0 items-center gap-1 text-positive"><CheckCircleIcon className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{t("table.menu.existing", { description: row.existing.description })}</span></span>}
    {row.status === "PENDING" && <span className="text-warning">{t("table.menu.pending")}</span>}
    {row.payment && <span className="text-warning">{t("table.menu.payment")}</span>}
    {row.amount === null && <span className="text-warning">{t("errors.currency.description")}</span>}
  </span>;
}
