import { cn } from "@/lib/utils";
import type { UsageTier } from "../_lib/card-usage";

type CardUsageBarProps = {
  usagePercent: number;
  tier: UsageTier;
};

export function CardUsageBar({ usagePercent, tier }: CardUsageBarProps) {
  const width = Math.min(Math.max(usagePercent, 0), 100);

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full", {
          "bg-positive": tier === "ok",
          "bg-warning": tier === "warning",
          "bg-negative": tier === "critical",
        })}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
