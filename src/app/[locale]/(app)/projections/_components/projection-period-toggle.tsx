"use client";

import { useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  MONTHS_AHEAD_OPTIONS,
  type MonthsAheadOption,
} from "../_constants/constants";

type ProjectionPeriodToggleProps = {
  value: MonthsAheadOption;
  onValueChange: (value: MonthsAheadOption) => void;
};

export function ProjectionPeriodToggle({
  value,
  onValueChange,
}: ProjectionPeriodToggleProps) {
  const t = useTranslations("scrn-projections");

  return (
    <ToggleGroup
      type="single"
      variant="tabs"
      size="sm"
      value={String(value)}
      onValueChange={(next) => {
        if (next) onValueChange(Number(next) as MonthsAheadOption);
      }}
    >
      {MONTHS_AHEAD_OPTIONS.map((option) => (
        <ToggleGroupItem key={option} value={String(option)}>
          {t(`periodToggle.${option}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
