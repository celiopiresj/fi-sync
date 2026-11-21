import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MonthFlowTileProps = {
  tone: "positive" | "negative";
  icon: ReactNode;
  label: string;
  value: string;
};

const TONE_CLASSES = {
  positive: { tile: "bg-positive/10 border-positive/15", icon: "bg-positive/15 text-positive" },
  negative: { tile: "bg-negative/10 border-negative/15", icon: "bg-negative/15 text-negative" },
} as const;

// One side of the month summary (money in / money out). Two lines: icon +
// short label on top, the amount alone underneath. The amount never
// truncates; it steps down a size when the tile itself is narrow (a
// container query, so it follows the tile's width, not the viewport's).
export function MonthFlowTile({ tone, icon, label, value }: MonthFlowTileProps) {
  return (
    <div
      className={cn(
        "@container flex min-w-0 flex-col gap-1.5 rounded-xl border p-3",
        TONE_CLASSES[tone].tile,
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg",
            TONE_CLASSES[tone].icon,
          )}
        >
          {icon}
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </span>
      <span className="font-heading text-sm font-bold whitespace-nowrap text-foreground tabular-nums @[9rem]:text-base @[13rem]:text-lg">
        {value}
      </span>
    </div>
  );
}
