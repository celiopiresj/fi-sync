import { cn } from "@/lib/utils";
import type { UsageTier } from "../_lib/card-usage";

type CardUsageBarProps = {
  usagePercent: number;
  tier: UsageTier;
  label?: string;
};

export function CardUsageBar({ usagePercent, tier, label }: CardUsageBarProps) {
  const width = Math.min(Math.max(usagePercent, 0), 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(usagePercent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn("h-full rounded-full transition-all", {
          "bg-positive": tier === "ok",
          "bg-warning": tier === "warning",
          "bg-negative": tier === "critical",
        })}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
