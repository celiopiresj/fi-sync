"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { DATE_ONLY_FORMAT_OPTIONS, parseCalendarDate } from "@/lib/date";
import { buildPersonStatementMessage } from "../_lib/statement-message";
import { buildWhatsAppLink } from "../_lib/whatsapp-message";
import type { PersonStatement, StatementPeriod } from "../_types/types";

type WhatsAppPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statement: NonNullable<PersonStatement>;
  period: StatementPeriod;
  phoneCountryCode?: string | null;
  phone?: string | null;
};

type DialogContentBodyProps = Omit<WhatsAppPreviewDialogProps, "open">;

function WhatsAppPreviewContent({
  onOpenChange,
  statement,
  period,
  phoneCountryCode,
  phone,
}: DialogContentBodyProps) {
  const t = useTranslations("scrn-people");
  const format = useFormatter();

  const [activeTab, setActiveTab] = useState<"preview" | "filter">("preview");
  const [copied, setCopied] = useState(false);

  const allCardItems = useMemo(
    () => statement.cardSections.flatMap((section) => section.items),
    [statement.cardSections],
  );

  const [selectedMovementIds, setSelectedMovementIds] = useState<Set<string>>(
    () => new Set(statement.movements.map((movement) => movement.id)),
  );
  const [selectedCardItemIds, setSelectedCardItemIds] = useState<Set<string>>(
    () => new Set(allCardItems.map((item) => item.id)),
  );
  const [selectedLoanItemIds, setSelectedLoanItemIds] = useState<Set<string>>(
    () => new Set(statement.loanItems.map((item) => item.id)),
  );

  const totalItemCount =
    statement.movements.length + allCardItems.length + statement.loanItems.length;
  const selectedCount =
    selectedMovementIds.size + selectedCardItemIds.size + selectedLoanItemIds.size;

  const message = useMemo(() => {
    return buildPersonStatementMessage(statement, period, t, format, {
      selectedMovementIds,
      selectedCardItemIds,
      selectedLoanItemIds,
    });
  }, [
    statement,
    period,
    t,
    format,
    selectedMovementIds,
    selectedCardItemIds,
    selectedLoanItemIds,
  ]);

  const targetPhoneCountryCode = phoneCountryCode ?? statement.person.phoneCountryCode;
  const targetPhone = phone ?? statement.person.phone;

  const whatsappLink = useMemo(() => {
    return buildWhatsAppLink(targetPhoneCountryCode, targetPhone, message);
  }, [targetPhoneCountryCode, targetPhone, message]);

  const money = (value: number) =>
    format.number(value, { style: "currency", currency: "BRL" });

  const periodLabelDate = parseCalendarDate(
    `${period.year}-${String(period.month + 1).padStart(2, "0")}-01`,
  );
  const periodLabel = format.dateTime(periodLabelDate, {
    year: "numeric",
    month: "long",
  });

  function handleSelectAll() {
    setSelectedMovementIds(new Set(statement.movements.map((movement) => movement.id)));
    setSelectedCardItemIds(new Set(allCardItems.map((item) => item.id)));
    setSelectedLoanItemIds(new Set(statement.loanItems.map((item) => item.id)));
  }

  function handleDeselectAll() {
    setSelectedMovementIds(new Set());
    setSelectedCardItemIds(new Set());
    setSelectedLoanItemIds(new Set());
  }

  function toggleMovement(id: string) {
    setSelectedMovementIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCardItem(id: string) {
    setSelectedCardItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleLoanItem(id: string) {
    setSelectedLoanItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  }

  return (
    <DialogContent
      closeLabel={t("aria.close")}
      className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
    >
      <DialogHeader>
        <DialogTitle>{t("detail.whatsapp.previewTitle")}</DialogTitle>
        <DialogDescription>
          {t("detail.whatsapp.previewDescription")}
        </DialogDescription>
      </DialogHeader>

      {totalItemCount > 0 ? (
        <div className="flex flex-col gap-2.5 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            className="flex w-full rounded-xl bg-muted p-0.75 sm:w-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "preview"}
              onClick={() => setActiveTab("preview")}
              className={cn(
                "flex h-9 grow cursor-pointer items-center justify-center whitespace-nowrap rounded-lg px-2.5 text-xs font-medium transition-colors sm:h-7 sm:grow-0 sm:px-3",
                activeTab === "preview"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("detail.whatsapp.tabMessage")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "filter"}
              onClick={() => setActiveTab("filter")}
              className={cn(
                "flex h-9 grow cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium transition-colors sm:h-7 sm:grow-0 sm:px-3",
                activeTab === "filter"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{t("detail.whatsapp.tabFilter")}</span>
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {selectedCount}/{totalItemCount}
              </span>
            </button>
          </div>

          {activeTab === "filter" ? (
            <div className="flex items-center justify-center gap-3 text-xs sm:justify-end">
              <button
                type="button"
                onClick={handleSelectAll}
                className="min-h-8 cursor-pointer font-medium text-primary hover:underline sm:min-h-0"
              >
                {t("detail.whatsapp.selectAll")}
              </button>
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="min-h-8 cursor-pointer text-muted-foreground hover:text-foreground hover:underline sm:min-h-0"
              >
                {t("detail.whatsapp.deselectAll")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "preview" ? (
        <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-surface-1 p-3 text-xs/relaxed sm:text-sm">
          {message}
        </pre>
      ) : (
        <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
          {statement.movements.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col">
                <span className="text-xs font-semibold">
                  {t("detail.movements.title")}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {t("detail.whatsapp.movementsNote")}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {statement.movements.map((movement) => {
                  const checked = selectedMovementIds.has(movement.id);
                  return (
                    <label
                      key={movement.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-3 rounded-md border p-2.5 transition-colors",
                        checked
                          ? "border-border bg-card hover:bg-surface-1"
                          : "border-border/60 bg-surface-1/40 opacity-60 hover:opacity-100",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleMovement(movement.id)}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-xs font-medium sm:text-sm">
                            {movement.description}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {format.dateTime(
                              movement.date,
                              DATE_ONLY_FORMAT_OPTIONS,
                            )}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-medium tabular-nums sm:text-sm">
                        {money(movement.amount)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {allCardItems.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">
                  {t("detail.invoices.title", { month: periodLabel })}
                </span>
                {statement.cardSections.length > 0 &&
                  statement.cardSections.every((s) => s.isPaid) && (
                    <span className="rounded-sm bg-positive/10 px-1.5 py-0.5 text-[10px] font-medium text-positive">
                      {t("detail.invoices.paidBadge")}
                    </span>
                  )}
              </div>
              <div className="flex flex-col gap-1.5">
                {allCardItems.map((item) => {
                  const checked = selectedCardItemIds.has(item.id);
                  const installmentText =
                    item.installmentCount && item.installmentCount > 1
                      ? t("detail.invoices.installment", {
                          number: item.installmentNumber ?? 0,
                          count: item.installmentCount,
                        })
                      : t("detail.invoices.cash");

                  return (
                    <label
                      key={item.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-3 rounded-md border p-2.5 transition-colors",
                        checked
                          ? "border-border bg-card hover:bg-surface-1"
                          : "border-border/60 bg-surface-1/40 opacity-60 hover:opacity-100",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleCardItem(item.id)}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-xs font-medium sm:text-sm">
                            {item.description}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {format.dateTime(item.date, DATE_ONLY_FORMAT_OPTIONS)}{" "}
                            · {installmentText}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-medium tabular-nums text-negative sm:text-sm">
                        {money(item.amount)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {statement.loanItems.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col">
                <span className="text-xs font-semibold">
                  {t("detail.loans.title")}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {statement.loanItems.map((item) => {
                  const checked = selectedLoanItemIds.has(item.id);
                  const installmentText =
                    item.installmentCount && item.installmentCount > 1
                      ? t("detail.invoices.installment", {
                          number: item.installmentNumber ?? 0,
                          count: item.installmentCount,
                        })
                      : t("detail.invoices.cash");

                  return (
                    <label
                      key={item.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-3 rounded-md border p-2.5 transition-colors",
                        checked
                          ? "border-border bg-card hover:bg-surface-1"
                          : "border-border/60 bg-surface-1/40 opacity-60 hover:opacity-100",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleLoanItem(item.id)}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-xs font-medium sm:text-sm">
                            {item.description}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {format.dateTime(item.date, DATE_ONLY_FORMAT_OPTIONS)}{" "}
                            · {installmentText}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-medium tabular-nums text-negative sm:text-sm">
                        {money(item.amount)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="flex h-11 items-center justify-center gap-1.5 sm:h-8"
        >
          {copied ? (
            <>
              <CheckIcon aria-hidden="true" className="size-3.5 text-positive" />
              <span>{t("detail.whatsapp.copied")}</span>
            </>
          ) : (
            <>
              <CopyIcon aria-hidden="true" className="size-3.5" />
              <span>{t("detail.whatsapp.copy")}</span>
            </>
          )}
        </Button>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 sm:h-8"
            onClick={() => onOpenChange(false)}
          >
            {t("detail.whatsapp.cancel")}
          </Button>
          {whatsappLink ? (
            <Button
              asChild
              size="sm"
              className="h-11 sm:h-8"
              onClick={() => onOpenChange(false)}
            >
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("detail.whatsapp.send")}
              </a>
            </Button>
          ) : (
            <Button size="sm" className="h-11 sm:h-8" disabled>
              {t("detail.whatsapp.send")}
            </Button>
          )}
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

export function WhatsAppPreviewDialog({
  open,
  onOpenChange,
  ...props
}: WhatsAppPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <WhatsAppPreviewContent onOpenChange={onOpenChange} {...props} />
      ) : null}
    </Dialog>
  );
}
