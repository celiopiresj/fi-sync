import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { ListIcon, SquaresFourIcon } from "@phosphor-icons/react";

// The cards/list segmented control repeated in invoices/people/budgets —
// each copy-pasted the same `ToggleGroup variant="tabs"` markup.
export type ViewMode = "cards" | "list";

type ViewModeToggleProps = {
  value: ViewMode;
  onValueChange: (value: ViewMode) => void;
  cardsLabel: string;
  listLabel: string;
  className?: string;
};

export function ViewModeToggle({
  value,
  onValueChange,
  cardsLabel,
  listLabel,
  className,
}: ViewModeToggleProps) {
  return (
    <ToggleGroup
      type="single"
      variant="tabs"
      size="sm"
      value={value}
      className={cn("hidden min-[700px]:flex", className)}
      onValueChange={(next) => {
        if (next) onValueChange(next as ViewMode);
      }}
    >
      <ToggleGroupItem value="cards" aria-label={cardsLabel} className="h-7 min-w-7">
        <SquaresFourIcon aria-hidden="true" />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label={listLabel} className="h-7 min-w-7">
        <ListIcon aria-hidden="true" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
