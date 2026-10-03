import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { capitalizeFirst } from "@/lib/capitalize-first";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";

// Shared "screen title row" — title/subtitle on the left, an optional
// badge next to the title (e.g. a result count), and an optional right
// slot (usually `PeriodStepper` below). Every list screen in the app
// (`accounts`, `budgets`, `cards`, `categories`, `invoices`, `people`,
// `recurrences`, `transactions`) renders this same row; before this
// component each screen hand-rolled its own copy with small drifts
// (different heading sizes, different subtitle colors).
type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  right?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  badge,
  right,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{title}</h1>
          {badge}
        </div>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {right}
    </div>
  );
}

// The prev/label/next control every period-scoped screen (`budgets`,
// `invoices`, `transactions`, `people/[id]`) renders next to its
// `PageHeader` — extracted as its own component (rather than baked into
// `PageHeader`) so `person-detail-view.tsx` can render it on its own row
// below the header instead of inline, without duplicating the button/label
// markup.
type PeriodStepperProps = {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel: string;
  nextLabel: string;
  // For a stepper with a bounded range (e.g. card payoff can't start
  // before the first invoice still owing anything) — unbounded otherwise.
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  className?: string;
};

export function PeriodStepper({
  label,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  previousDisabled = false,
  nextDisabled = false,
  className,
}: PeriodStepperProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onPrevious}
        disabled={previousDisabled}
        aria-label={previousLabel}
      >
        <CaretLeftIcon />
      </Button>
      {/* capitalizeFirst, not Tailwind's `capitalize` class — that's a
          per-WORD text-transform, which would also capitalize "de" in a
          pt-BR label like "setembro de 2026" ("Setembro De 2026"). */}
      <span className="min-w-32 text-center text-sm font-medium">
        {capitalizeFirst(label)}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={nextLabel}
      >
        <CaretRightIcon />
      </Button>
    </div>
  );
}
