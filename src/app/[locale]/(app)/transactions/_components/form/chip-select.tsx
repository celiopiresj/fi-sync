"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { parseLocalCalendarDate, formatLocalCalendarDate } from "@/lib/date";
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
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { PickerSearchInput } from "@/components/form/picker-search-input";

// The batch entry form's compact chip pattern — a small pill (unselected:
// dashed border, accent text, shows the field's own label; selected:
// solid border, shows the chosen value) that opens a Popover on desktop
// (`md`+) or a bottom Sheet on mobile. Same responsive shell as
// PickerRowField/DatePickerRowField (components/form/picker-row-field.tsx),
// but visually and behaviorally its own thing — a row of wrapping chips,
// not a bordered list of rows — so it's kept as its own small component
// here rather than forcing the two patterns to share one API.
function ChipTrigger({
  isFilled,
  isInvalid,
  children,
  ref,
  ...props
}: {
  isFilled: boolean;
  isInvalid?: boolean;
  children: ReactNode;
} & ComponentProps<"button">) {
  return (
    <button
      {...props}
      ref={ref}
      type="button"
      className={cn(
        "inline-flex h-8 max-w-full items-center gap-1 truncate rounded-full border px-3 text-xs font-medium transition-colors",
        isFilled
          ? "border-border bg-muted text-foreground"
          : isInvalid
            ? "border-red-400 text-red-600 dark:text-red-400"
            : "border-dashed border-border text-primary",
      )}
    >
      {children}
    </button>
  );
}

// Generic over the option value type (defaults to plain `string`) so
// callers backed by a narrower literal union — e.g. batch's Pagamento
// chip, whose draft field is `PaymentMethodOption | ""` — get that same
// union back out of `onChange` instead of a widened `string` that can't
// be assigned straight into the draft patch. Conta/Categoria/Pessoa stay
// exactly as before: `T` just infers as `string` for those.
type ChipSelectProps<T extends string> = {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  formatDisplay?: (label: string) => string;
  footer?: ReactNode;
  isInvalid?: boolean;
  sheetTitle: string;
};

export function ChipSelect<T extends string = string>({
  label,
  value,
  onChange,
  options,
  formatDisplay,
  footer,
  isInvalid,
  sheetTitle,
}: ChipSelectProps<T>) {
  const t = useTranslations("common");
  const isMobile = useIsMobile();
  const [openState, setOpenState] = useState(false);
  const [query, setQuery] = useState("");

  function setOpen(next: boolean) {
    if (!next) setQuery("");
    setOpenState(next);
  }
  const open = openState;

  const selected = options.find((option) => option.value === value);
  const displayLabel = selected
    ? formatDisplay
      ? formatDisplay(selected.label)
      : selected.label
    : label;

  const trigger = (
    <ChipTrigger isFilled={Boolean(selected)} isInvalid={isInvalid}>
      {displayLabel}
    </ChipTrigger>
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) => {
        const optionLabel = formatDisplay
          ? formatDisplay(option.label)
          : option.label;
        return optionLabel.toLowerCase().includes(normalizedQuery);
      })
    : options;

  const content = (
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
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs/relaxed transition-colors hover:bg-muted",
              option.value === value && "bg-muted font-medium",
            )}
          >
            {formatDisplay ? formatDisplay(option.label) : option.label}
          </button>
        ))}
        {normalizedQuery && filteredOptions.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-muted-foreground">
            {t("picker.noResults")}
          </p>
        ) : null}
      </div>
      {footer}
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          closeLabel={sheetTitle}
          className="max-h-[85vh] gap-0"
        >
          <SheetHeader>
            <SheetTitle>{sheetTitle}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-6 pb-6">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="p-1.5">
        {content}
      </PopoverContent>
    </Popover>
  );
}

type DateChipSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isInvalid?: boolean;
  sheetTitle: string;
};

// Calendar-flavored sibling of ChipSelect above — same shell, a
// `Calendar` instead of an option list. Displays the raw "yyyy-MM-dd"
// value directly (day/month/year digits, locale-agnostic) rather than a
// formatted date — this is a dense entry chip, not the single-
// transaction form's picker row, so it skips next-intl formatting
// entirely rather than asking every call site for a formatter.
export function DateChipSelect({
  label,
  value,
  onChange,
  isInvalid,
  sheetTitle,
}: DateChipSelectProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Explicit focus instead of plain `autoFocus` — same Radix Sheet
  // focus-trap race as picker-row-field.tsx's own DatePickerRowField,
  // re-run on every open since this component stays mounted across
  // opens/closes.
  useEffect(() => {
    if (open) dateInputRef.current?.focus();
  }, [open]);

  const parsedDate = parseLocalCalendarDate(value);
  const displayLabel = parsedDate
    ? `${String(parsedDate.getDate()).padStart(2, "0")}/${String(
        parsedDate.getMonth() + 1,
      ).padStart(2, "0")}`
    : label;

  const trigger = (
    <ChipTrigger isFilled={Boolean(parsedDate)} isInvalid={isInvalid}>
      {displayLabel}
    </ChipTrigger>
  );

  const content = (
    <div className="flex flex-col gap-2">
      {/* Typing is just as valid an entry method as clicking a day —
          same pairing as picker-row-field.tsx's own DatePickerRowField. */}
      <Input
        ref={dateInputRef}
        type="date"
        value={value}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
      />
      <Calendar
        mode="single"
        selected={parsedDate}
        onSelect={(date) => {
          if (!date) return;
          onChange(formatLocalCalendarDate(date));
          setOpen(false);
        }}
      />
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          closeLabel={sheetTitle}
          className="max-h-[85vh] gap-0"
        >
          <SheetHeader>
            <SheetTitle>{sheetTitle}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-6 pb-6">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      {/* w-auto: the Calendar shrink-wraps to its own w-fit sizing —
          PopoverContent's default w-72 left a blank strip on the right
          otherwise (same fix as picker-row-field.tsx's DatePickerRowField). */}
      <PopoverContent align="start" className="w-auto p-1.5">
        {content}
      </PopoverContent>
    </Popover>
  );
}
