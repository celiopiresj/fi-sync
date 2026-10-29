"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CaretRightIcon } from "@phosphor-icons/react";
import { useIsMobile } from "@/hooks/use-mobile";
import { matchesSearch } from "@/lib/normalize-search";
import { cn } from "@/lib/utils";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import { PickerSearchInput } from "@/components/form/picker-search-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export type PickerRowOption = {
  value: string;
  label: string;
};

type PickerRowProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: PickerRowOption[];
  formatDisplay?: (label: string) => string;
  footer?: ReactNode;
  disabled?: boolean;
  error?: string;
};

export function PickerRow({
  label,
  placeholder,
  value,
  onChange,
  options,
  formatDisplay,
  footer,
  disabled,
  error,
}: PickerRowProps) {
  const t = useTranslations("common");
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) setQuery("");
    setOpen(next);
  }

  const selectedOption = options.find((option) => option.value === value);
  const displayLabel = selectedOption
    ? formatDisplay
      ? formatDisplay(selectedOption.label)
      : selectedOption.label
    : undefined;
  const isFilled = displayLabel !== undefined;

  const hasQuery = Boolean(query.trim());
  const filteredOptions = hasQuery
    ? options.filter((option) => {
        const optionLabel = formatDisplay
          ? formatDisplay(option.label)
          : option.label;
        return matchesSearch(optionLabel, query);
      })
    : options;

  function choose(nextValue: string) {
    onChange(nextValue);
    handleOpenChange(false);
  }

  const trigger = (
    <Item
      asChild
      size="sm"
      className="h-9.5 min-h-9.5 w-full cursor-pointer justify-between rounded-none border-0 px-3 py-0 hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50"
    >
      <button type="button" disabled={disabled || options.length === 0}>
        <ItemContent className="flex-none">
          <ItemTitle className="font-normal text-muted-foreground">
            {label}
          </ItemTitle>
        </ItemContent>
        <span
          className={cn(
            "ml-auto flex min-w-0 items-center gap-1.5 text-right",
            isFilled ? "text-foreground" : "text-primary",
          )}
        >
          <span className="truncate">
            {isFilled ? displayLabel : placeholder}
          </span>
          <CaretRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </span>
      </button>
    </Item>
  );

  const listContent = (
    <>
      {options.length > 0 ? (
        <PickerSearchInput
          value={query}
          onChange={setQuery}
          placeholder={t("picker.searchPlaceholder")}
          clearLabel={t("picker.searchClear")}
        />
      ) : null}
      <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
        {filteredOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            className={cn(
              "flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs/relaxed transition-colors hover:bg-muted",
              option.value === value && "bg-muted font-medium",
            )}
          >
            {formatDisplay ? formatDisplay(option.label) : option.label}
          </button>
        ))}
        {hasQuery && filteredOptions.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-muted-foreground">
            {t("picker.noResults")}
          </p>
        ) : null}
      </div>
      {footer}
    </>
  );

  return (
    <div className="flex flex-col">
      {isMobile ? (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent
            side="bottom"
            closeLabel={label}
            className="max-h-[85vh] gap-0"
          >
            <SheetHeader>
              <SheetTitle>{label}</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-6 pb-6">{listContent}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="start" className="p-1.5">
            {listContent}
          </PopoverContent>
        </Popover>
      )}
      {error ? (
        <p className="mt-1 px-3 pb-1 text-xs text-negative">{error}</p>
      ) : null}
    </div>
  );
}

