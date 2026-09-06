"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useStatementImport } from "@/hooks/use-statement-import";
import {
  ACCEPTED_IMPORT_MEDIA_TYPES,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_FILE_MB,
  type StatementEntry,
} from "@/lib/statement-import/schema";
import { resolveAmount } from "../../_lib/batch-amounts";
import {
  statementEntriesToCreditRows,
  statementEntriesToDebitRows,
} from "../../_lib/statement-import-rows";
import type {
  BatchRowFormValues,
  CreditBatchRowFormValues,
} from "../../_schema/schema";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
} from "../../_types/types";
import { BatchRowFields } from "../form/batch-row-fields";
import { ImportCreditRowFields } from "./import-credit-row-fields";
import { ImportReviewStep } from "./import-review-step";
import { ImportSourceStep } from "./import-source-step";

type ImportStatementScreenProps = {
  accounts: AccountOption[];
  categories: CategoryOption[];
  people: PersonOption[];
  defaultPersonId: string | null;
  onSubmitDebit: (
    rows: BatchRowFormValues[],
  ) => Promise<{ error: string | null; rowIndex: number | null }>;
  onSubmitCredit: (
    rows: CreditBatchRowFormValues[],
  ) => Promise<{ error: string | null; rowIndex: number | null }>;
  onSuccess: (count: number) => void;
  // What the container already draws around this screen. The FAB drawer
  // gives the screen the whole surface (so it owns the title and the
  // close control); /transactions' sheet has its own SheetHeader and
  // close button, and passes neither.
  showTitle?: boolean;
  onClose?: () => void;
};

// The FAB's "importar fatura ou extrato" screen: pick where the entries
// land, attach a PDF/photo, then review what was read as ordinary batch
// rows. Nothing is written until that review is submitted, and it goes
// out through the same two batch Server Actions the manual flows use —
// the import fills the batch form, it doesn't bypass it.
export function ImportStatementScreen({
  accounts,
  categories,
  people,
  defaultPersonId,
  onSubmitDebit,
  onSubmitCredit,
  onSuccess,
  showTitle = true,
  onClose,
}: ImportStatementScreenProps) {
  const t = useTranslations("scrn-transactions");
  const statementImport = useStatementImport();
  const title = showTitle ? t("import.title") : null;

  const [accountId, setAccountId] = useState("");
  const [cardId, setCardId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<StatementEntry[] | null>(null);
  // Bumped on every successful read so the review step remounts with the
  // new rows — it keeps its own edited copy in state, which would
  // otherwise survive into a second file's review.
  const [readCount, setReadCount] = useState(0);

  const selectedAccount = accounts.find((account) => account.id === accountId);
  const isCredit = selectedAccount?.type === "CREDIT_CARD";
  const activeCards = (selectedAccount?.cards ?? []).filter(
    (card) => card.status === "ACTIVE" || card.id === cardId,
  );

  const creditRows = useMemo(
    () =>
      entries && isCredit
        ? statementEntriesToCreditRows(entries, {
            accountId,
            cardId,
            defaultPersonId,
          })
        : [],
    [entries, isCredit, accountId, cardId, defaultPersonId],
  );

  const debitRows = useMemo(
    () =>
      entries && !isCredit
        ? statementEntriesToDebitRows(entries, { accountId, defaultPersonId })
        : [],
    [entries, isCredit, accountId, defaultPersonId],
  );

  function handleSelectAccount(nextAccountId: string) {
    setAccountId(nextAccountId);
    // The titular's card defaults in, same as every other card picker —
    // the Portador chip only appears once there's a second one.
    const account = accounts.find((item) => item.id === nextAccountId);
    setCardId(account?.cards.find((card) => card.status === "ACTIVE")?.id ?? "");
    setError(null);
  }

  function handleSelectFile(nextFile: File | null) {
    setFile(nextFile);
    setError(null);
  }

  // Both checks are repeated server-side (the client can't be trusted
  // with either) — they run here so an 11 MB photo fails instantly
  // instead of after the upload.
  async function handleAnalyze() {
    if (!file || !selectedAccount) {
      setError(t("import.errors.noFile"));
      return;
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setError(t("import.errors.tooLarge", { size: MAX_IMPORT_FILE_MB }));
      return;
    }
    if (!ACCEPTED_IMPORT_MEDIA_TYPES.includes(file.type as never)) {
      setError(t("import.errors.unsupported"));
      return;
    }

    setError(null);
    try {
      const result = await statementImport.mutateAsync({
        file,
        source: isCredit ? "credit" : "debit",
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEntries(result.entries);
      setReadCount((current) => current + 1);
    } catch {
      // Anything the action didn't turn into a message of its own — a
      // network drop, a body the platform rejected outright.
      setError(t("import.errors.failed"));
    }
  }

  function handleBack() {
    setEntries(null);
    setError(null);
  }

  if (entries === null) {
    return (
      <ImportSourceStep
        accounts={accounts}
        accountId={accountId}
        cardId={cardId}
        file={file}
        error={error}
        isParsing={statementImport.isPending}
        title={title}
        onClose={onClose}
        onSelectAccount={handleSelectAccount}
        onSelectCard={setCardId}
        onSelectFile={handleSelectFile}
        onAnalyze={handleAnalyze}
      />
    );
  }

  // Only worth naming the specific card when the account has more than
  // one — otherwise the card's name just repeats the account's.
  const destinationLabel = [
    selectedAccount?.name,
    activeCards.length > 1
      ? activeCards.find((card) => card.id === cardId)?.name
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (isCredit) {
    return (
      <ImportReviewStep
        key={readCount}
        initialRows={creditRows}
        categories={categories}
        people={people}
        destinationLabel={destinationLabel}
        onBack={handleBack}
        title={title}
        onClose={onClose}
        isRowReady={(row) =>
          Boolean(row.description.trim()) &&
          resolveAmount(row.amount) !== null &&
          Boolean(row.date) &&
          Boolean(row.cardId) &&
          Boolean(row.categoryId) &&
          Boolean(row.personId)
        }
        renderBadges={(row) =>
          Number(row.installments) > 1 ? (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {t("fields.installments.optionLabel", {
                count: Number(row.installments),
              })}
            </span>
          ) : null
        }
        renderFields={(row, patch) => (
          <ImportCreditRowFields
            value={row}
            onChange={patch}
            cards={activeCards}
            categories={categories}
            people={people}
          />
        )}
        onSubmit={onSubmitCredit}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <ImportReviewStep
      key={readCount}
      initialRows={debitRows}
      categories={categories}
      people={people}
      destinationLabel={destinationLabel}
      onBack={handleBack}
      title={title}
      onClose={onClose}
      isRowReady={(row) =>
        Boolean(row.description.trim()) &&
        resolveAmount(row.amount) !== null &&
        Boolean(row.date) &&
        Boolean(row.paymentMethod) &&
        Boolean(row.categoryId) &&
        Boolean(row.personId)
      }
      renderBadges={(row) =>
        row.paymentMethod ? (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {t(`fields.paymentMethod.${row.paymentMethod}`)}
          </span>
        ) : null
      }
      renderFields={(row, patch) => (
        <BatchRowFields
          value={row}
          onChange={patch}
          accounts={accounts}
          categories={categories}
          people={people}
          // The account is fixed for the whole import (picked before the
          // file), so its chip is dropped — the Data chip stays, since
          // each row carries the date its own statement line reported.
          showAccountChip={false}
        />
      )}
      onSubmit={onSubmitDebit}
      onSuccess={onSuccess}
    />
  );
}
