"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CaretRightIcon } from "@phosphor-icons/react";
import { useFieldContext } from "@/lib/form/form-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  parseLocalCalendarDate,
  formatLocalCalendarDate,
} from "@/lib/date";
import { matchesSearch } from "@/lib/normalize-search";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import { Input } from "@/components/ui/input";
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
import { Calendar } from "@/components/ui/calendar";

// The "Nova transação" drawer's picker-row pattern (Data/Conta/
// Categoria/Pagamento/Pessoa): a ~38px row — label left (secondary
// text), value right, chevron — that opens a Popover on desktop (`md`+)
// or a bottom Sheet on mobile, both wrapping the same content. Two
// public field components share this shell: `PickerRowField` (a flat
// option list — Conta/Categoria/Pagamento/Pessoa) and
// `DatePickerRowField` (a `Calendar` — Data).
//
// Composition contract: rows render borderless/transparent by design —
// several of them are meant to sit inside ONE shared bordered container
// with dividers between rows (e.g.
// `<ItemGroup className="divide-y rounded-md border">…rows…</ItemGroup>`),
// per the drawer spec's "grouped in one bordered container with internal
// dividers." The group's border/divide-y is the caller's job, not this
// component's.
function PickerRow({
  label,
  displayValue,
  placeholder,
  isFilled,
  disabled,
  open,
  onOpenChange,
  sheetTitle,
  popoverClassName,
  children,
}: {
  label: string;
  displayValue: ReactNode;
  placeholder: string;
  isFilled: boolean;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetTitle: string;
  // Overrides PopoverContent's own default `w-72` — the flat option list
  // (PickerRowField) wants that fixed width for readable rows, but the
  // Calendar (DatePickerRowField) is meant to shrink-wrap to its own
  // `w-fit` sizing instead, which left a blank strip on the popover's
  // right side when stuck inside the wider default.
  popoverClassName?: string;
  children: ReactNode;
}) {
  // Same 768px cutoff as the drawer's own md breakpoint (see
  // hooks/use-mobile.ts) — Popover/Sheet are two different Radix trees,
  // so (unlike the transactions list's DataTable/mobile-list split) this
  // has to be a real JS check, not just a Tailwind hidden/block toggle.
  const isMobile = useIsMobile();

  const trigger = (
    <Item
      asChild
      size="sm"
      className="h-9.5 min-h-9.5 w-full cursor-pointer justify-between rounded-none border-0 px-3 py-0 hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50"
    >
      <button type="button" disabled={disabled}>
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
          <span className="truncate">{isFilled ? displayValue : placeholder}</span>
          <CaretRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </span>
      </button>
    </Item>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          closeLabel={sheetTitle}
          className="max-h-[85vh] gap-0"
        >
          <SheetHeader>
            <SheetTitle>{sheetTitle}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-6 pb-6">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className={cn("p-1.5", popoverClassName)}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

function PickerOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs/relaxed transition-colors hover:bg-muted",
        selected && "bg-muted font-medium",
      )}
    >
      {label}
    </button>
  );
}

type PickerOptionValue = { value: string; label: string };

type PickerRowFieldProps = {
  label: string;
  placeholder: string;
  options: PickerOptionValue[];
  // A real, explicitly-selectable "no value" row (e.g. Pessoa's
  // "Ninguém") — distinct from `placeholder`. When set, an empty field
  // value always renders `emptyOption.label` in normal text, never the
  // accent placeholder — for this field, "" is a deliberate answer, not
  // an unanswered one. Omit for fields where empty only ever means "not
  // chosen yet" (Conta, Categoria, Pagamento, and Pessoa in batch mode,
  // which has no "Ninguém" option at all).
  emptyOption?: { label: string };
  // Applied to each option's label before display (list rows and the
  // trigger's summary alike) — e.g. `formatPersonName` for Pessoa, so a
  // lazily-typed "mae" still renders "Mãe" wherever it's chosen from.
  formatDisplay?: (label: string) => string;
  // Extra content rendered below the option list, inside the same
  // Popover/Sheet — e.g. a "Cadastrar nova pessoa" action. Pair with
  // `open`/`onOpenChange` below if it needs to keep the picker open
  // while showing more of its own UI.
  footer?: ReactNode;
  disabled?: boolean;
  // Defaults to `label`. Also doubles as the mobile Sheet's close-button
  // accessible name, so it must be a real translated string, not UI
  // chrome text.
  sheetTitle?: string;
  // Uncontrolled (internal state) when omitted.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

// Registered as `PickerRowField` on `useAppForm`. Flat-list variant of
// the picker-row pattern — Conta/Categoria/Pagamento/Pessoa in the
// single-transaction form.
export function PickerRowField({
  label,
  placeholder,
  options,
  emptyOption,
  formatDisplay,
  footer,
  disabled,
  sheetTitle,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: PickerRowFieldProps) {
  const t = useTranslations("common");
  const field = useFieldContext<string>();
  const [openState, setOpenState] = useState(false);
  const [query, setQuery] = useState("");
  const open = openProp ?? openState;

  function handleOpenChange(next: boolean) {
    if (!next) setQuery("");
    (onOpenChangeProp ?? setOpenState)(next);
  }

  const selectedOption = options.find(
    (option) => option.value === field.state.value,
  );
  const displayLabel = selectedOption
    ? formatDisplay
      ? formatDisplay(selectedOption.label)
      : selectedOption.label
    : emptyOption?.label;
  const isFilled = displayLabel !== undefined;

  const hasQuery = Boolean(query.trim());
  const filteredOptions = hasQuery
    ? options.filter((option) => {
        const label = formatDisplay ? formatDisplay(option.label) : option.label;
        return matchesSearch(label, query);
      })
    : options;

  function choose(value: string) {
    field.handleChange(value);
    handleOpenChange(false);
  }

  return (
    <div className="flex flex-col">
      <PickerRow
        label={label}
        displayValue={displayLabel}
        placeholder={placeholder}
        isFilled={isFilled}
        disabled={disabled}
        open={open}
        onOpenChange={handleOpenChange}
        sheetTitle={sheetTitle ?? label}
      >
        {options.length > 0 ? (
          <PickerSearchInput
            value={query}
            onChange={setQuery}
            placeholder={t("picker.searchPlaceholder")}
            clearLabel={t("picker.searchClear")}
          />
        ) : null}
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {emptyOption ? (
            <PickerOption
              label={emptyOption.label}
              selected={field.state.value === ""}
              onClick={() => choose("")}
            />
          ) : null}
          {filteredOptions.map((option) => (
            <PickerOption
              key={option.value}
              label={formatDisplay ? formatDisplay(option.label) : option.label}
              selected={option.value === field.state.value}
              onClick={() => choose(option.value)}
            />
          ))}
          {hasQuery && filteredOptions.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              {t("picker.noResults")}
            </p>
          ) : null}
        </div>
        {footer}
      </PickerRow>
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
        <p className="mt-1 px-3 text-xs text-red-600 dark:text-red-400">
          {field.state.meta.errors.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

type DatePickerRowFieldProps = {
  label: string;
  placeholder: string;
  // Formats the field's value for display in the trigger row. Receives
  // an already-parsed local `Date` (see `parseLocalCalendarDate` in
  // @/lib/date), not the raw "yyyy-MM-dd" string — so callers can pass e.g.
  // `(date) => format.dateTime(date, {dateStyle: "long"})` straight from
  // next-intl's `useFormatter()` without needing to think about
  // timezones themselves: a `Date` built from LOCAL getters, formatted
  // with next-intl's default (also local) timeZone, round-trips to the
  // same calendar day no matter what zone the browser is in. Passing the
  // raw string and letting each call site parse it its own way is how
  // that guarantee breaks — e.g. routing it through `@/lib/date`'s
  // `parseCalendarDate` (APP_TIME_ZONE, for user input headed to
  // storage/math) and then formatting without an explicit `timeZone`
  // (which defaults to the *browser's* zone) can roll the displayed day
  // back or forward whenever those two zones disagree. Locale/style
  // itself still stays a caller concern, same as this file's other
  // `formatDisplay` props.
  formatDisplay: (date: Date) => string;
  disabled?: boolean;
  sheetTitle?: string;
};

// Registered as `DatePickerRowField` on `useAppForm`. Calendar variant of
// the picker-row pattern — Data in the single-transaction form.
export function DatePickerRowField({
  label,
  placeholder,
  formatDisplay,
  disabled,
  sheetTitle,
}: DatePickerRowFieldProps) {
  const field = useFieldContext<string>();
  const [open, setOpen] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Plain `autoFocus` races Radix's own focus-trap effect on the mobile
  // Sheet variant (same issue debit-transaction-form.tsx's own
  // amountInputRef works around) — focus explicitly instead, re-running
  // on every open since this component stays mounted across opens/closes
  // (only `open` itself toggles, no remount to re-trigger a mount-only
  // effect).
  useEffect(() => {
    if (open) dateInputRef.current?.focus();
  }, [open]);

  const parsedDate = parseLocalCalendarDate(field.state.value);

  return (
    <div className="flex flex-col">
      <PickerRow
        label={label}
        displayValue={parsedDate ? formatDisplay(parsedDate) : null}
        placeholder={placeholder}
        isFilled={Boolean(parsedDate)}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
        sheetTitle={sheetTitle ?? label}
        popoverClassName="w-auto"
      >
        <div className="flex flex-col gap-2">
          {/* Typing is just as valid an entry method as clicking a day —
              a native date input, same as DateField's own (which has no
              picker at all), kept in sync with the Calendar below: both
              read/write the same "yyyy-MM-dd" field value, so picking a
              day updates this input and typing a date moves the
              Calendar's own selection. */}
          <Input
            ref={dateInputRef}
            type="date"
            value={field.state.value}
            onChange={(e) => {
              if (e.target.value) field.handleChange(e.target.value);
            }}
          />
          <Calendar
            mode="single"
            selected={parsedDate}
            onSelect={(date) => {
              if (!date) return;
              field.handleChange(formatLocalCalendarDate(date));
              setOpen(false);
            }}
          />
        </div>
      </PickerRow>
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
        <p className="mt-1 px-3 text-xs text-red-600 dark:text-red-400">
          {field.state.meta.errors.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
