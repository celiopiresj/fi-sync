import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MagnifyingGlassIcon, SpinnerIcon, XIcon } from "@phosphor-icons/react";

// The search box repeated (with tiny drift — h-8 vs h-9, icon offset
// left-2.5 vs left-3.5) across transactions/invoices/recurrences/people/
// budgets/categories. Standardizes on `Input`'s own default height
// (h-9). Fixed at `sm:w-100` (400px) from the `sm` breakpoint up rather
// than `w-full` — every caller's row is a plain `flex` container sized
// to its own content, not a block parent that would actually give
// `w-full` something to fill, so that resolved to the box's own tiny
// intrinsic width instead of growing it. Stays `w-full` below `sm` so a
// fixed 400px doesn't overflow a phone viewport — and `basis-full`
// there too, because inside those same content-sized flex rows `w-full`
// alone still collapsed to a sliver next to the row's other controls
// ("Buscar por desc…" cut off on a phone); a full basis makes it take its
// own line in a wrapping row instead. A caller passing `className` can
// still override this.
type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel: string;
  className?: string;
  // Swaps the static magnifying glass for a spinner — for a search that
  // hits the server on every keystroke (e.g. /transactions', backed by
  // TanStack Query's own `isFetching`), not the in-memory filters
  // elsewhere that resolve instantly and have nothing to show a loading
  // state for. Omit (or false) to keep the plain icon.
  isLoading?: boolean;
};

export function SearchInput({
  value,
  onChange,
  placeholder,
  clearLabel,
  className,
  isLoading,
}: SearchInputProps) {
  return (
    <div className={cn("relative w-full basis-full sm:w-100 sm:basis-auto", className)}>
      {isLoading ? (
        <SpinnerIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-8"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clearLabel}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
