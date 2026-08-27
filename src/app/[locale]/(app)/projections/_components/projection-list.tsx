"use client";

import { useFormatter, useTranslations } from "next-intl";
import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { monthKeyToDate } from "../_lib/projection-month";
import { RISK_BADGE_CLASS } from "../_lib/risk-status-style";
import type { ProjectionEntry } from "../_types/types";

type ProjectionListProps = {
  entries: ProjectionEntry[];
};

export function ProjectionList({ entries }: ProjectionListProps) {
  const t = useTranslations("scrn-projections");
  const format = useFormatter();

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.columns.month")}</TableHead>
            <TableHead className="text-right">
              {t("table.columns.income")}
            </TableHead>
            <TableHead className="text-right">
              {t("table.columns.expenses")}
            </TableHead>
            <TableHead className="text-right">
              {t("table.columns.balance")}
            </TableHead>
            <TableHead>{t("table.columns.status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.monthKey}>
              <TableCell>
                <Link
                  href={`/projections/${entry.monthKey}`}
                  className="font-medium capitalize hover:underline"
                >
                  {format.dateTime(monthKeyToDate(entry.monthKey), {
                    month: "short",
                    year: "2-digit",
                  })}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums text-positive">
                {money(entry.incomeForecast)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-negative">
                {money(entry.totalExpenses)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-medium tabular-nums",
                  entry.status !== "ok" && "text-negative",
                )}
              >
                {money(entry.projectedBalance)}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn("w-fit", RISK_BADGE_CLASS[entry.status])}
                >
                  {entry.status === "ok" ? (
                    <CheckCircleIcon />
                  ) : (
                    <WarningCircleIcon />
                  )}
                  {t(`status.${entry.status}`)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
