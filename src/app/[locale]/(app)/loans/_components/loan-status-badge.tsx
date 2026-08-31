import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LoanStatus } from "../actions";

const STATUS_MESSAGE_KEY: Record<LoanStatus, string> = {
  ON_TRACK: "onTrack",
  OVERDUE: "overdue",
  SETTLED: "settled",
};

export function loanStatusMessageKey(status: LoanStatus): string {
  return STATUS_MESSAGE_KEY[status];
}

type LoanStatusBadgeProps = {
  status: LoanStatus;
  label: string;
};

// Same bg-*/10 translucent semantic-token convention as
// invoices/_components/invoice-status-badge.tsx — OVERDUE gets
// `--negative` (money owed that's late), SETTLED gets `--positive`
// (fully paid off), ON_TRACK stays a plain outline (nothing to flag).
export function LoanStatusBadge({ status, label }: LoanStatusBadgeProps) {
  if (status === "OVERDUE") {
    return (
      <Badge
        variant="outline"
        className={cn("border-negative/30 bg-negative/10 text-negative")}
      >
        {label}
      </Badge>
    );
  }
  if (status === "SETTLED") {
    return (
      <Badge
        variant="outline"
        className={cn("border-positive/30 bg-positive/10 text-positive")}
      >
        {label}
      </Badge>
    );
  }
  return <Badge variant="outline">{label}</Badge>;
}
