"use client";

import { createElement, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form/form-error";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  IMPORT_FILE_ACCEPT,
  MAX_IMPORT_FILE_MB,
} from "@/lib/statement-import/schema";
import {
  BankIcon,
  CameraIcon,
  CreditCardIcon,
  FilePdfIcon,
  PaperclipIcon,
  SpinnerIcon,
} from "@phosphor-icons/react";
import { filterDebitBatchAccounts } from "../../_lib/batch-accounts";
import type { AccountOption } from "../../_types/types";
import { ChipSelect } from "../form/chip-select";
import { ImportStepHeader } from "./import-step-header";

type ImportSourceStepProps = {
  accounts: AccountOption[];
  accountId: string;
  cardId: string;
  file: File | null;
  error: string | null;
  isParsing: boolean;
  // Container-supplied chrome — see ImportStepHeader.
  title: string | null;
  onClose?: () => void;
  onSelectAccount: (accountId: string) => void;
  onSelectCard: (cardId: string) => void;
  onSelectFile: (file: File | null) => void;
  onAnalyze: () => void;
};

// First half of the import: WHERE the entries land, then WHAT to read.
// The destination is picked before the file on purpose — it decides
// which kind of row the file produces (card purchases with parcelas vs.
// account entries with a payment method), and picking it up front means
// a bank layout this app has never seen still lands on the right
// account instead of depending on the model recognizing it.
export function ImportSourceStep({
  accounts,
  accountId,
  cardId,
  file,
  error,
  isParsing,
  title,
  onClose,
  onSelectAccount,
  onSelectCard,
  onSelectFile,
  onAnalyze,
}: ImportSourceStepProps) {
  const t = useTranslations("scrn-transactions");
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Archived accounts stay out of every transaction picker (tasks/007),
  // and an import is only ever a create — there is no "but this old row
  // already points at it" case to keep one around for.
  const activeAccounts = accounts.filter(
    (account) => account.status === "ACTIVE",
  );
  const cardAccounts = activeAccounts.filter(
    (account) => account.type === "CREDIT_CARD",
  );
  const debitAccounts = filterDebitBatchAccounts(activeAccounts);

  const selectedAccount = accounts.find((account) => account.id === accountId);
  const activeCards = (selectedAccount?.cards ?? []).filter(
    (card) => card.status === "ACTIVE" || card.id === cardId,
  );

  const hasDestinations = cardAccounts.length > 0 || debitAccounts.length > 0;

  function renderGroup(
    label: string,
    group: AccountOption[],
    icon: typeof CreditCardIcon,
  ) {
    if (group.length === 0) return null;
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        {group.map((account) => {
          const isSelected = account.id === accountId;
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => onSelectAccount(account.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent/50",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {createElement(icon, { className: "size-4.5" })}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {account.name}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ImportStepHeader title={title} onClose={onClose} />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{t("import.source.title")}</p>
            <p className="text-xs text-muted-foreground">
              {t("import.source.description")}
            </p>
          </div>

          {hasDestinations ? (
            <>
              {renderGroup(
                t("import.source.cards"),
                cardAccounts,
                CreditCardIcon,
              )}
              {renderGroup(t("import.source.accounts"), debitAccounts, BankIcon)}
              {/* Same "only ask once there's more than the titular's own
                  card" gating as every other card picker in this screen. */}
              {activeCards.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  <ChipSelect
                    label={t("fields.card.holderLabel")}
                    value={cardId}
                    onChange={onSelectCard}
                    options={activeCards.map((card) => ({
                      value: card.id,
                      label: card.name,
                    }))}
                    sheetTitle={t("fields.card.holderLabel")}
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("import.source.empty")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{t("import.file.title")}</p>
            <p className="text-xs text-muted-foreground">
              {t("import.file.description", { size: MAX_IMPORT_FILE_MB })}
            </p>
          </div>

          {/* Two inputs rather than one: `capture` makes a phone open the
              camera straight away, which is wrong for the "pick the PDF I
              already have" case and right for "photograph this statement". */}
          <input
            ref={fileInputRef}
            type="file"
            accept={IMPORT_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
          />

          {file ? (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <FilePdfIcon className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => fileInputRef.current?.click()}
              >
                {t("import.file.replace")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <PaperclipIcon />
                {t("import.file.choose")}
              </Button>
              {isMobile && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <CameraIcon />
                  {t("import.file.camera")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-border p-4">
        <FormError title={t("toast.error")} description={error} />
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={!accountId || !file || isParsing}
          onClick={onAnalyze}
        >
          {isParsing && <SpinnerIcon className="size-4 animate-spin" />}
          {isParsing ? t("import.parsing.title") : t("import.file.analyze")}
        </Button>
        {isParsing && (
          <p className="text-center text-xs text-muted-foreground">
            {t("import.parsing.description")}
          </p>
        )}
      </div>
    </div>
  );
}
