import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";

// The search box repeated (with tiny drift — h-8 vs h-9, icon offset
// left-2.5 vs left-3.5) across transactions/invoices/recurrences/people/
// budgets/categories. Standardizes on `Input`'s own default height (h-9).
type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel: string;
  className?: string;
};

export function SearchInput({
  value,
  onChange,
  placeholder,
  clearLabel,
  className,
}: SearchInputProps) {
  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
