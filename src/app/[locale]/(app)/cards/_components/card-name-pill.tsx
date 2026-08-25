import { cn } from "@/lib/utils";
import type { CreditCardAccountRow } from "../_types/types";

type CardNamePillProps = {
  account: Pick<CreditCardAccountRow, "name" | "status">;
};

// Just the bank name in a pill — used by UpcomingDueSection, which is a
// lightweight "what's due when" summary and deliberately doesn't repeat
// the CardChip/meta treatment the heavier sections (Atenção necessária,
// Todos os cartões) use for the same account.
export function CardNamePill({ account }: CardNamePillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border px-3 py-1 text-sm font-medium",
        account.status === "ACTIVE" ? "text-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {account.name}
    </span>
  );
}
