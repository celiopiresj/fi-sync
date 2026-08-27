import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  className?: string;
};

export function PeriodStepper({
  label,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  className,
}: PeriodStepperProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onPrevious}
        aria-label={previousLabel}
      >
        <CaretLeftIcon />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium capitalize">
        {label}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onNext}
        aria-label={nextLabel}
      >
        <CaretRightIcon />
      </Button>
    </div>
  );
}
