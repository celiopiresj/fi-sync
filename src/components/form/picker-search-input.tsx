"use client";

import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";

// Compact search box for the option list inside PickerRowField/ChipSelect's
// popover or bottom sheet — same icon+clear pattern as the screen-level
// SearchInput (components/screen/search-input.tsx), but sized to fit a
// w-72 popover instead of a full search bar, and autofocused since it's
// meant to be typed into immediately on open.
type PickerSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel: string;
};

export function PickerSearchInput({
  value,
  onChange,
  placeholder,
  clearLabel,
}: PickerSearchInputProps) {
  return (
    <div className="relative mb-1.5 shrink-0">
      <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus
        className="h-8 pl-8 pr-7 text-xs"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clearLabel}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
