"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeftIcon,
  CaretDownIcon,
  PlusIcon,
  ReceiptIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { DATE_ONLY_FORMAT_OPTIONS, parseCalendarDate } from "@/lib/date";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PeriodStepper } from "@/components/screen/page-header";
import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import { getPersonColorClasses, getPersonInitial } from "../../_lib/person-avatar";
import { joinPersonPhone } from "../../_lib/phone";
import {
  currentStatementPeriod,
  shiftStatementPeriod,
} from "../../_lib/cash-cycle";
import { usePersonStatement } from "../_hooks/use-person-statement";
import { buildWhatsAppLink } from "../../_lib/whatsapp-message";
import { buildPersonStatementMessage } from "../../_lib/statement-message";
import { WhatsAppPreviewDialog } from "../../_components/whatsapp-preview-dialog";
import type { PersonStatement, StatementPeriod } from "../_types/types";
// Deliberate cross-route dependency, not the usual per-route
// self-containment duplication (see AGENTS.md) — same reasoning
// invoice-detail-view.tsx's own identical import already documents:
// this reuses the exact same forms/sheets and their installment/
// invoice-resolution/recurrence-conversion logic rather than
// re-implementing any of it here for a screen that just needs to
// create/edit the same kind of rows filtered to one person.
import { DebitTransactionSheet } from "../../../transactions/_components/form/debit-transaction-sheet";
import { CreditTransactionSheet } from "../../../transactions/_components/form/credit-transaction-sheet";
import { SpecialTransactionDialog } from "../../../transactions/_components/special-transaction-dialog";
import {
  resolveSpecialTransactionKind,
  type SpecialTransactionKind,
} from "../../../transactions/_lib/special-transaction";
import { useTransactionFormOptions } from "../../../transactions/_hooks/use-transaction-form-options";
import {
  createDebitTransaction,
  updateDebitTransaction,
  createTransactionsBatch,
  createCreditTransaction,
  updateCreditTransaction,
  createCreditTransactionsBatch,
  getTransactionById,
} from "../../../transactions/actions";
import type {
  AccountOption,
  CategoryOption,
  PersonOption,
  TransactionRow,
} from "../../../transactions/_types/types";
import type {
  BatchRowFormValues,
  CreditBatchRowFormValues,
  CreditTransactionFormValues,
  DebitTransactionFormValues,
} from "../../../transactions/_schema/schema";

type PersonDetailViewProps = {
  personId: string;
  initialStatement: NonNullable<PersonStatement>;
  transactionAccounts: AccountOption[];
  transactionCategories: CategoryOption[];
  initialTransactionPeople: PersonOption[];
  initialDefaultPersonId: string | null;
  defaultDebitAccountId: string | null;
  defaultCreditAccountId: string | null;
};

// Same create/edit union transactions-view.tsx's own dialogState uses,
// minus "duplicate" (not offered from this page) — "kind" decides which
// of the two sheets is open, and for "edit" which one depends on the
// clicked row's own account type (resolved once the full row loads, see
// handleRowClick below — the statement's own movement/card-item rows
// only carry a few display fields, not enough to prefill an edit form).
type DialogState =
  | { mode: "create"; kind: "debit" | "credit" }
  | { mode: "edit"; kind: "debit" | "credit"; row: TransactionRow }
  | null;

export function PersonDetailView({
  personId,
  initialStatement,
  transactionAccounts,
  transactionCategories,
  initialTransactionPeople,
  initialDefaultPersonId,
  defaultDebitAccountId,
  defaultCreditAccountId,
}: PersonDetailViewProps) {
  const t = useTranslations("scrn-people");
  const tCommon = useTranslations("common");
  const format = useFormatter();

  // Captured once, separately from the mutable `period` state below —
  // `initialStatement` was only ever fetched server-side for THIS
  // period (see page.tsx), so usePersonStatement needs to know whether
  // `period` still matches it before reusing it as `initialData` for a
  // different period's own query key. Same split as invoices-view.tsx's
  // own initialPeriod/period.
  const [initialPeriod] = useState(() => currentStatementPeriod());
  const [period, setPeriod] = useState<StatementPeriod>(initialPeriod);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  // True while a clicked row's full Transaction is being fetched (see
  // handleRowClick) — the statement's own rows don't carry enough to
  // prefill the edit form directly.
  const [isLoadingRow, setIsLoadingRow] = useState<string | null>(null);
  // Set instead of dialogState whenever the fetched row turns out to be
  // special (resolveSpecialTransactionKind) — same redirect-instead-of-
  // edit behavior as the main /transactions screen; see
  // SpecialTransactionDialog's own comment.
  const [specialTransaction, setSpecialTransaction] =
    useState<SpecialTransactionKind | null>(null);

  const isDefaultPeriod =
    period.year === initialPeriod.year && period.month === initialPeriod.month;

  const { data: statement, invalidate } = usePersonStatement(
    personId,
    period,
    initialStatement,
    isDefaultPeriod,
  );

  const { people, defaultPersonId } = useTransactionFormOptions(
    initialTransactionPeople,
    initialDefaultPersonId,
  );

  const money = (value: number) =>
    format.number(value, { style: "currency", currency: "BRL" });

  const periodLabelDate = parseCalendarDate(
    `${period.year}-${String(period.month + 1).padStart(2, "0")}-01`,
  );
  const periodLabel = format.dateTime(periodLabelDate, {
    year: "numeric",
    month: "long",
  });

  const isTotalOwedByUser = statement ? statement.totalToSettle >= 0 : true;
  const totalTitleKey = isTotalOwedByUser
    ? "detail.summary.totalToPay"
    : "detail.summary.totalToReceive";
  const totalLegendKey = isTotalOwedByUser
    ? "detail.summary.totalToPayLegend"
    : "detail.summary.totalToReceiveLegend";

  // Only unpaid invoices count as "pending" — a paid one's items already
  // rolled into `statement.balance` (see getPersonStatement in
  // actions.ts), so surfacing them again here would double them up.
  const pendingCardSections =
    statement?.cardSections.filter((section) => !section.isPaid) ?? [];

  // Shown above the "Movimentações da conta" header — same real signed
  // sum the list below it already displays per-row, just totaled.
  const movementsTotal =
    statement?.movements.reduce((sum, movement) => sum + movement.amount, 0) ?? 0;

  const movementsRangeLabel = statement
    ? t(
        statement.cashCycle.isOpen
          ? "detail.movements.rangeOpen"
          : "detail.movements.rangeClosed",
        {
          from: format.dateTime(statement.cashCycle.start, {
            day: "2-digit",
            month: "2-digit",
          }),
          to: format.dateTime(statement.cashCycle.end, {
            day: "2-digit",
            month: "2-digit",
          }),
        },
      )
    : "";

  const message = statement
    ? buildPersonStatementMessage(statement, period, t, format)
    : "";

  // Loan installments (statement.loanItems) are deliberately NOT
  // clickable here — a pending one has no linked Transaction yet (see
  // getPersonStatement's own loanItems query, transactionId: null), so
  // there's nothing for this transaction form to edit; settling one goes
  // through /loans' own "Registrar pagamento" instead.
  async function handleRowClick(transactionId: string) {
    setIsLoadingRow(transactionId);
    const row = await getTransactionById(transactionId);
    setIsLoadingRow(null);
    if (!row) {
      toast.error(tCommon("errorGeneric"));
      return;
    }
    const special = resolveSpecialTransactionKind(row);
    if (special) {
      setSpecialTransaction(special);
      return;
    }
    setDialogState({
      mode: "edit",
      kind: row.account.type === "CREDIT_CARD" ? "credit" : "debit",
      row,
    });
  }

  async function handleSubmitDebit(
    values: DebitTransactionFormValues,
  ): Promise<{ error: string | null }> {
    const isEditing = dialogState?.mode === "edit" && dialogState.kind === "debit";
    const result = isEditing
      ? await updateDebitTransaction(dialogState.row.id, values)
      : await createDebitTransaction(values);
    if (!result.error) {
      invalidate();
      toast.success(t(isEditing ? "detail.toast.transactionUpdated" : "detail.toast.transactionCreated"));
    }
    return result;
  }

  async function handleSubmitDebitBatch(rows: BatchRowFormValues[]) {
    const result = await createTransactionsBatch(rows);
    if (!result.error) {
      invalidate();
    }
    return result;
  }

  async function handleSubmitCredit(
    values: CreditTransactionFormValues,
    options?: Parameters<typeof updateCreditTransaction>[2],
  ): Promise<{ error: string | null }> {
    const isEditing = dialogState?.mode === "edit" && dialogState.kind === "credit";
    const result = isEditing
      ? await updateCreditTransaction(dialogState.row.id, values, options)
      : await createCreditTransaction(values, options);
    if (!result.error) {
      invalidate();
      toast.success(t(isEditing ? "detail.toast.transactionUpdated" : "detail.toast.transactionCreated"));
    }
    return result;
  }

  async function handleSubmitCreditBatch(rows: CreditBatchRowFormValues[]) {
    const result = await createCreditTransactionsBatch(rows);
    if (!result.error) {
      invalidate();
    }
    return result;
  }

  function handleBatchSuccess(count: number) {
    toast.success(t("detail.toast.transactionsCreated", { count }));
  }

  if (!statement) return null;

  const phone = joinPersonPhone(
    statement.person.phoneCountryCode,
    statement.person.phone,
  );
  const color = getPersonColorClasses(statement.person.name, statement.person.colorStyle);
  const whatsappLink = buildWhatsAppLink(
    statement.person.phoneCountryCode,
    statement.person.phone,
    message,
  );

  function handleWhatsAppClick() {
    if (!whatsappLink) {
      toast.error(t("detail.whatsapp.noPhoneToast"));
      return;
    }
    setPreviewOpen(true);
  }

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <Link
        href="/people"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("detail.back")}
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback className={color}>
              {getPersonInitial(statement.person.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-lg font-semibold">{statement.person.name}</span>
            {phone ? (
              <span className="text-sm text-muted-foreground">{phone}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <PlusIcon />
                {t("detail.buttons.addTransaction")}
                <CaretDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => setDialogState({ mode: "create", kind: "debit" })}
              >
                {t("buttons.newExpense")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setDialogState({ mode: "create", kind: "credit" })}
              >
                {t("detail.buttons.newCardExpense")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleWhatsAppClick} title={whatsappLink ? undefined : t("detail.header.noPhone")}>
            <WhatsappLogoIcon weight="fill" />
            {t("detail.header.whatsappButton")}
          </Button>
        </div>
      </div>

      <PeriodStepper
        className="justify-center"
        label={periodLabel}
        onPrevious={() => setPeriod((current) => shiftStatementPeriod(current, -1))}
        onNext={() => setPeriod((current) => shiftStatementPeriod(current, 1))}
        previousLabel={t("detail.period.previous")}
        nextLabel={t("detail.period.next")}
      />

      <KpiGrid>
        <KpiCard
          label={t("detail.summary.balance")}
          value={money(statement.balance)}
        />
        <KpiCard
          label={t("detail.summary.invoice")}
          value={money(Math.abs(statement.pendingCardTotal))}
        />
        <KpiCard
          label={t("detail.summary.paidThisMonth")}
          value={money(statement.paidThisMonth)}
        />
        <KpiCard
          label={t(totalTitleKey)}
          value={money(Math.abs(statement.totalToSettle))}
          tone={isTotalOwedByUser ? "negative" : "positive"}
          subtitle={t(totalLegendKey)}
        />
      </KpiGrid>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-sm font-medium">{t("detail.movements.title")}</h2>
            <Badge
              variant="secondary"
              className={cn(
                "tabular-nums",
                movementsTotal >= 0 ? "text-positive" : "text-negative",
              )}
            >
              {money(movementsTotal)}
            </Badge>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {movementsRangeLabel}
          </span>
        </div>

        {statement.movements.length === 0 ? (
          <Empty className="border-none py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ReceiptIcon />
              </EmptyMedia>
              <EmptyTitle>{t("detail.movements.empty")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="rounded-md border border-border">
            <div className="divide-y divide-border">
              {statement.movements.map((movement) => (
                <button
                  key={movement.id}
                  type="button"
                  onClick={() => handleRowClick(movement.id)}
                  disabled={isLoadingRow === movement.id}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-60"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {movement.description}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format.dateTime(movement.date, DATE_ONLY_FORMAT_OPTIONS)}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-medium tabular-nums",
                      movement.amount >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {money(movement.amount)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {pendingCardSections.map((section) => (
        <div key={section.accountId} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-sm font-medium">{section.accountName}</h2>
              {/* The sum of the rows listed right below, nothing else.
                  It used to show `remaining` (this person's share minus
                  whatever they'd already paid toward the invoice), which
                  read as a broken total: two rows of -89,99 and -100,00
                  under a badge saying -2,81. The already-paid part now
                  has its own line in the section footer. */}
              <Badge
                variant="secondary"
                className={cn(
                  "tabular-nums",
                  section.total >= 0 ? "text-positive" : "text-negative",
                )}
              >
                {money(section.total)}
              </Badge>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("detail.invoices.title", { month: periodLabel })}
            </span>
          </div>

          <div className="rounded-md border border-border">
            <div className="divide-y divide-border">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleRowClick(item.id)}
                  disabled={isLoadingRow === item.id}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-60"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {item.description}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format.dateTime(item.date, DATE_ONLY_FORMAT_OPTIONS)} ·{" "}
                      {item.installmentCount && item.installmentCount > 1
                        ? t("detail.invoices.installment", {
                            number: item.installmentNumber ?? 0,
                            count: item.installmentCount,
                          })
                        : t("detail.invoices.cash")}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-medium tabular-nums",
                      item.amount >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {money(item.amount)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Only when this person already settled part of this invoice
              (see `paid` in getPersonStatement) — otherwise the badge
              above already says everything there is to say. */}
          {section.paid !== 0 && (
            <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground tabular-nums">
              <span>{t("detail.invoices.paid", { value: money(section.paid) })}</span>
              <span>
                {t("detail.invoices.remaining", {
                  value: money(section.remaining),
                })}
              </span>
            </div>
          )}
        </div>
      ))}

      {statement.loanItems.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-sm font-medium">{t("detail.loans.title")}</h2>
              {/* Always text-negative, unlike movements/card sections
                  above — a loan installment has no sign ambiguity to
                  reflect (always a real expense, see getPersonStatement's
                  own comment), same convention its own per-item rows
                  already follow. */}
              <Badge variant="secondary" className="tabular-nums text-negative">
                {money(statement.pendingLoanTotal)}
              </Badge>
            </div>
          </div>

          <div className="rounded-md border border-border">
            <div className="divide-y divide-border">
              {statement.loanItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {item.description}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format.dateTime(item.date, DATE_ONLY_FORMAT_OPTIONS)} ·{" "}
                      {item.installmentCount && item.installmentCount > 1
                        ? t("detail.invoices.installment", {
                            number: item.installmentNumber ?? 0,
                            count: item.installmentCount,
                          })
                        : t("detail.invoices.cash")}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-negative">
                    {money(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {whatsappLink ? (
        <WhatsAppPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          message={message}
          whatsappLink={whatsappLink}
        />
      ) : null}

      <SpecialTransactionDialog
        open={specialTransaction !== null}
        onOpenChange={(open) => {
          if (!open) setSpecialTransaction(null);
        }}
        special={specialTransaction}
      />

      <DebitTransactionSheet
        open={dialogState !== null && dialogState.kind === "debit"}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        mode={dialogState?.mode ?? "create"}
        prefill={dialogState?.mode === "edit" && dialogState.kind === "debit" ? dialogState.row : null}
        accounts={transactionAccounts}
        categories={transactionCategories}
        people={people}
        defaultPersonId={defaultPersonId}
        defaultAccountId={defaultDebitAccountId}
        onSubmit={handleSubmitDebit}
        onSubmitBatch={handleSubmitDebitBatch}
        onBatchSuccess={handleBatchSuccess}
      />

      <CreditTransactionSheet
        open={dialogState !== null && dialogState.kind === "credit"}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        mode={dialogState?.mode ?? "create"}
        prefill={dialogState?.mode === "edit" && dialogState.kind === "credit" ? dialogState.row : null}
        accounts={transactionAccounts}
        categories={transactionCategories}
        people={people}
        defaultPersonId={defaultPersonId}
        defaultAccountId={defaultCreditAccountId ?? undefined}
        onSubmit={handleSubmitCredit}
        onSubmitBatch={handleSubmitCreditBatch}
        onBatchSuccess={handleBatchSuccess}
      />
    </div>
  );
}
