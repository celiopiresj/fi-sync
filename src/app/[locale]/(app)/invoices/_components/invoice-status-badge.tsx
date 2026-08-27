import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InvoiceDisplayStatus } from "../_schema/schema";

// Maps a display status to the message key under the screen's own
// `status.*` messages — `PARTIALLY_PAID` needs this indirection since
// `status.toLowerCase()` alone would produce "partially_paid", not the
// camelCase key convention every other message file uses.
const statusMessageKey: Record<InvoiceDisplayStatus, string> = {
  OPEN: "open",
  CLOSED: "closed",
  PARTIALLY_PAID: "partiallyPaid",
  PAID: "paid",
};

export function invoiceStatusMessageKey(status: InvoiceDisplayStatus): string {
  return statusMessageKey[status];
}

type InvoiceStatusBadgeProps = {
  status: InvoiceDisplayStatus;
  label: string;
};

// Shared between the invoices list (grid + table) and the detail page —
// PARTIALLY_PAID gets the app's `--warning` semantic token (it's an
// "attention" tier, not fully settled but not just sitting open either),
// same bg-*/10 translucent convention as the rest of the app's
// status/money coloring (AGENTS.md).
export function InvoiceStatusBadge({ status, label }: InvoiceStatusBadgeProps) {
  if (status === "PARTIALLY_PAID") {
    return (
      <Badge variant="outline" className={cn("border-warning/30 bg-warning/10 text-warning")}>
        {label}
      </Badge>
    );
  }
  const variant = status === "PAID" ? "default" : status === "CLOSED" ? "secondary" : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}
