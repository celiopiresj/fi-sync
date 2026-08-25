"use client";

import { useTranslations } from "next-intl";
import {
  thresholdColorForPercentage,
  clampPercentage,
} from "../_lib/budget-calculations";

// Tailwind classes for each threshold color — using `bg-*` utilities
// against the shadcn semantic palette where possible, falling back to
// Tailwind's named-color utilities for yellow/orange which don't have
// a one-to-one shadcn token.
export const BAR_CLASSES: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  orange: "bg-orange-500",
  red: "bg-destructive",
};

type BudgetProgressBarProps = {
  percentage: number;
  limit: string;
};

export function BudgetProgressBar({
  percentage,
  limit,
}: BudgetProgressBarProps) {
  const t = useTranslations("scrn-budgets");
  const color = thresholdColorForPercentage(percentage);
  const clamped = clampPercentage(percentage);
  const barClass = BAR_CLASSES[color] ?? BAR_CLASSES.green;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={t("aria.progressBar", {
        percentage: Math.round(percentage).toString(),
        limit,
      })}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${barClass}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
