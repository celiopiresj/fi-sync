import { cn } from "@/lib/utils";
import type { CardRow } from "../_types/types";

type CardChipProps = {
  cards: Pick<CardRow, "lastFourDigits" | "colorStyle">[];
  status: "ACTIVE" | "INACTIVE";
};

// The "•••• 1234 +2" identification chip described by the cards-screen
// spec — first physical card's last 4 digits, plus a "+N" for any
// additional physical cards on the account. Solid dark fill for an
// active account, apagado/muted fill for a disabled one (section 4 of
// the spec) so a disabled account reads as visually distinct without
// needing its badge to carry that alone.
export function CardChip({ cards, status }: CardChipProps) {
  const [first, ...rest] = cards;
  const digits = first?.lastFourDigits ?? "----";
  const customColor = first?.colorStyle;

  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-md px-2 text-xs font-medium tabular-nums",
        status === "ACTIVE"
          ? customColor || "bg-foreground text-background"
          : "bg-muted text-muted-foreground",
      )}
    >
      •••• {digits}
      {rest.length > 0 ? ` +${rest.length}` : ""}
    </span>
  );
}
