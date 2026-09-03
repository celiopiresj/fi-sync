import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// The single "stat card" shape reused at the top of every screen
// (accounts/invoices/budgets/people/categories all rendered their own
// slightly different version of this). `tone` maps to the app's
// finance-specific CSS tokens (`--positive`/`--negative`/`--warning`,
// defined in globals.css) — never raw Tailwind `emerald-*`/`rose-*`, per
// AGENTS.md's money/status color convention. Passing `icon` switches to
// the "icon badge + stacked text" layout (people list); omitting it uses
// the plain stacked layout (invoices/budgets/person-detail).
export type KpiTone = "default" | "positive" | "negative" | "warning";

const TONE_TEXT: Record<KpiTone, string> = {
  default: "text-foreground",
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning",
};

// The translucent "tinted surface" every tone-carrying chip in this
// family shares — the icon badge and `KpiPill` render the same swatch,
// so they stay one map rather than two copies that can drift apart.
const TONE_TINT: Record<KpiTone, string> = {
  default: "bg-muted text-muted-foreground",
  positive: "bg-positive/10 text-positive",
  negative: "bg-negative/10 text-negative",
  warning: "bg-warning/10 text-warning",
};

// Where `icon` sits relative to the text. "leading" is the wide layout
// (icon badge on the left, text stacked beside it) used across the
// desktop screens; "inline" stacks everything instead — icon and label
// sharing the top line, value under them — which is what fits two cards
// side by side on a phone without the value wrapping.
type KpiIconPlacement = "leading" | "inline";

type KpiCardProps = {
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
  tone?: KpiTone;
  icon?: ReactNode;
  iconPlacement?: KpiIconPlacement;
  className?: string;
};

// `tone` colors the value (the number the card exists to show) — label
// and subtitle stay `text-muted-foreground` by default. A caller that
// needs the subtitle itself colored (e.g. budgets' "Excedido em +R$X")
// passes a pre-styled node as `subtitle` instead — its own color class
// wins over the wrapper's muted color.
export function KpiCard({
  label,
  value,
  subtitle,
  tone = "default",
  icon,
  iconPlacement = "leading",
  className,
}: KpiCardProps) {
  if (icon && iconPlacement === "inline") {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-md",
                TONE_TINT[tone],
              )}
            >
              {icon}
            </span>
            <span className="min-w-0 truncate">{label}</span>
          </span>
          <span
            className={cn(
              "text-xl font-semibold tabular-nums",
              tone !== "default" && TONE_TEXT[tone],
            )}
          >
            {value}
          </span>
          {subtitle ? <span className="text-xs">{subtitle}</span> : null}
        </CardContent>
      </Card>
    );
  }

  if (icon) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              TONE_TINT[tone],
            )}
          >
            {icon}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">
              {label}
            </span>
            <span
              className={cn(
                "text-lg font-semibold tabular-nums",
                tone !== "default" && TONE_TEXT[tone],
              )}
            >
              {value}
            </span>
            {subtitle ? (
              <span className="text-xs text-muted-foreground">
                {subtitle}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "text-xl font-semibold tabular-nums",
            tone !== "default" && TONE_TEXT[tone],
          )}
        >
          {value}
        </span>
        {subtitle ? (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

type KpiPillProps = {
  tone?: KpiTone;
  children: ReactNode;
};

// The small tinted capsule a KPI hangs under its value to qualify it
// ("+12,4% vs. mês anterior", "8,2% dentro do orçamento"). Passed as a
// card's `subtitle`; every screen that wants one uses this rather than
// re-typing the rounded-full/px-2/py-0.5 chip markup per call site.
export function KpiPill({ tone = "default", children }: KpiPillProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        TONE_TINT[tone],
      )}
    >
      {children}
    </span>
  );
}

type KpiGridProps = {
  columns?: 2 | 3 | 4;
  className?: string;
  children: ReactNode;
};

const COLUMNS_CLASS: Record<2 | 3 | 4, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

export function KpiGrid({ columns = 4, className, children }: KpiGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2",
        COLUMNS_CLASS[columns],
        className,
      )}
    >
      {children}
    </div>
  );
}
