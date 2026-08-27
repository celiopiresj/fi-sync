import { cn } from "@/lib/utils";
import type { CreditCardAccountRow } from "../_types/types";

type CardNamePillProps = {
  account: Pick<CreditCardAccountRow, "name" | "status" | "cards">;
};

// Just the bank name in a pill — used by UpcomingDueSection, which is a
// lightweight "what's due when" summary and deliberately doesn't repeat
// the CardChip/meta treatment the heavier sections (Atenção necessária,
// Todos os cartões) use for the same account. Colored via the first
// physical card's own colorStyle (the same value ColorPicker/CardChip
// already use) when set — an uncolored or disabled account falls back
// to a plain outlined pill.
export function CardNamePill({ account }: CardNamePillProps) {
  const colorStyle = account.cards[0]?.colorStyle;
  const isColored = account.status === "ACTIVE" && Boolean(colorStyle);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
        isColored
          ? colorStyle
          : account.status === "ACTIVE"
            ? "border border-border text-foreground"
            : "border border-border bg-muted text-muted-foreground",
      )}
    >
      {account.name}
    </span>
  );
}
