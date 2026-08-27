"use client";

import { useTranslations } from "next-intl";
import { CalendarBlankIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import type { UpcomingDueGroup } from "../_types/types";
import { CardNamePill } from "./card-name-pill";

type UpcomingDueSectionProps = {
  groups: UpcomingDueGroup[];
};

// Groups every account (active + disabled) by dueDay — fechaDia
// deliberately doesn't appear here (spec section 1), since this section
// is a lightweight "what's due when" summary: just the bank name as a
// pill, not the full chip/meta row the other sections use. Groups sit
// side by side rather than stacked, so the common case of a handful of
// distinct due days stays a single glance instead of a scroll.
export function UpcomingDueSection({ groups }: UpcomingDueSectionProps) {
  const t = useTranslations("scrn-cards");

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarBlankIcon className="size-4 text-positive" />
          {t("sections.upcoming.title")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {t("sections.upcoming.sortedHint")}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-4 rounded-lg bg-surface-1 p-4">
        {groups.map((group) => (
          <div key={group.dueDay} className="flex w-full max-w-64 min-w-48 flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">
                {t("sections.upcoming.groupLabel", { dueDay: group.dueDay })}
              </span>
              <Badge variant="secondary">
                {t("sections.upcoming.daysUntil", { days: group.daysUntilDue })}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.accounts.map((account) => (
                <CardNamePill key={account.id} account={account} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
