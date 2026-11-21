"use client";

import { KpiCard, KpiGrid } from "@/components/screen/kpi-card";
import { PeriodStepper } from "@/components/screen/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { DATE_ONLY_FORMAT_OPTIONS, parseCalendarDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
    ArrowLeftIcon,
    CaretDownIcon,
    CaretLeftIcon,
    CaretRightIcon,
    PlusIcon,
    ReceiptIcon,
    UsersIcon,
    WhatsappLogoIcon,
} from "@phosphor-icons/react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { WhatsAppPreviewDialog } from "../../_components/whatsapp-preview-dialog";
import { usePersonMoney } from "../../_hooks/use-person-money";
import {
    currentStatementPeriod,
    shiftStatementPeriod,
} from "../../_lib/cash-cycle";
import {
    getPersonColorClasses,
    getPersonInitial,
} from "../../_lib/person-avatar";
import { joinPersonPhone } from "../../_lib/phone";
import { usePersonStatement } from "../_hooks/use-person-statement";
import type { PersonStatement, StatementPeriod } from "../_types/types";
// this reuses the exact same forms/sheets and their installment/
// invoice-resolution/recurrence-conversion logic rather than
// re-implementing any of it here for a screen that just needs to
// create/edit the same kind of rows filtered to one person.
import { CreditTransactionSheet } from "../../../transactions/_components/form/credit-transaction-sheet";
import { DebitTransactionSheet } from "../../../transactions/_components/form/debit-transaction-sheet";
import { SpecialTransactionDialog } from "../../../transactions/_components/special-transaction-dialog";
import { useTransactionFormOptions } from "../../../transactions/_hooks/use-transaction-form-options";
import {
    resolveSpecialTransactionKind,
    type SpecialTransactionKind,
} from "../../../transactions/_lib/special-transaction";
import type {
    BatchRowFormValues,
    CreditBatchRowFormValues,
    CreditTransactionFormValues,
    DebitTransactionFormValues,
} from "../../../transactions/_schema/schema";
import type {
    AccountOption,
    CategoryOption,
    PersonOption,
    TransactionRow,
} from "../../../transactions/_types/types";
import {
    createCreditTransaction,
    createCreditTransactionsBatch,
    createDebitTransaction,
    createTransactionsBatch,
    getTransactionById,
    updateCreditTransaction,
    updateDebitTransaction,
} from "../../../transactions/actions";

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

  const {
    data: statement,
    isFetching,
    isError,
    refetch,
    invalidate,
  } = usePersonStatement(
    personId,
    period,
    initialStatement,
    isDefaultPeriod,
  );

  const { people, defaultPersonId } = useTransactionFormOptions(
    initialTransactionPeople,
    initialDefaultPersonId,
  );

  const money = usePersonMoney();

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

  if (!statement) {
    if (isError) {
      return (
        <div className="mx-auto flex max-w-350 flex-col gap-6 py-12">
          <Empty className="border-none">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("detail.errors.load.title")}</EmptyTitle>
              <EmptyDescription>
                {t("detail.errors.load.description")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button className="h-11 sm:h-9" onClick={() => refetch()}>
                {t("buttons.retry")}
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      );
    }

    return (
      <div
        aria-busy="true"
        className="mx-auto flex max-w-350 flex-col gap-6"
      >
        <Skeleton className="h-5 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  const phone = joinPersonPhone(
    statement.person.phoneCountryCode,
    statement.person.phone,
  );
  const color = getPersonColorClasses(statement.person.name, statement.person.colorStyle);

  function handleWhatsAppClick() {
    if (!statement?.person.phone) {
      toast.error(t("detail.whatsapp.noPhoneToast"));
      return;
    }
    setPreviewOpen(true);
  }

  const currentIndex = people.findIndex((p) => p.id === statement.person.id);
  const prevPerson =
    people.length > 1 && currentIndex !== -1
      ? people[(currentIndex - 1 + people.length) % people.length]
      : null;
  const nextPerson =
    people.length > 1 && currentIndex !== -1
      ? people[(currentIndex + 1) % people.length]
      : null;

  return (
    <div
      aria-busy={isFetching}
      className={cn(
        "mx-auto flex max-w-350 flex-col gap-6 transition-opacity",
        isFetching && "opacity-70",
      )}
    >
      <Link
        href="/people"
        className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:min-h-0"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        {t("detail.back")}
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback className={color}>
              {getPersonInitial(statement.person.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <h1 className="font-heading text-2xl font-bold tracking-tight break-words text-foreground">
              {statement.person.name}
            </h1>
            {phone ? (
              <span className="text-sm text-muted-foreground">{phone}</span>
            ) : null}
          </div>
        </div>
        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          {people.length > 1 ? (
            <div className="flex w-full items-center justify-between gap-1 rounded-2xl border border-border/80 bg-card p-1 shadow-xs sm:inline-flex sm:w-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
              {prevPerson ? (
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="size-10 rounded-xl sm:size-9 sm:rounded-md sm:border sm:border-input sm:bg-background sm:shadow-xs"
                  title={t("detail.header.previousPerson", { name: prevPerson.name })}
                >
                  <Link href={`/people/${prevPerson.id}`}>
                    <CaretLeftIcon aria-hidden="true" className="size-4" />
                    <span className="sr-only">
                      {t("detail.header.previousPerson", { name: prevPerson.name })}
                    </span>
                  </Link>
                </Button>
              ) : null}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-10 flex-1 gap-2 rounded-xl sm:h-9 sm:flex-none sm:rounded-md sm:border sm:border-input sm:bg-background sm:shadow-xs"
                  >
                    <UsersIcon aria-hidden="true" className="size-4" />
                    <span>{t("detail.header.switchPerson")}</span>
                    <CaretDownIcon
                      aria-hidden="true"
                      className="size-3 text-muted-foreground"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
                  <DropdownMenuLabel>{t("detail.header.peopleList")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {people.map((p) => {
                    const isCurrent = p.id === statement.person.id;
                    const pColor = getPersonColorClasses(p.name, p.colorStyle);
                    return (
                      <DropdownMenuItem
                        key={p.id}
                        asChild
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5",
                          isCurrent && "bg-muted font-medium",
                        )}
                      >
                        <Link href={`/people/${p.id}`}>
                          <Avatar size="sm" className="size-5 text-[10px]">
                            <AvatarFallback className={pColor}>
                              {getPersonInitial(p.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{p.name}</span>
                          {p.isSelf ? (
                            <span className="ml-auto text-[10px] text-muted-foreground">
                              {t("card.selfBadge")}
                            </span>
                          ) : null}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {nextPerson ? (
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="size-10 rounded-xl sm:size-9 sm:rounded-md sm:border sm:border-input sm:bg-background sm:shadow-xs"
                  title={t("detail.header.nextPerson", { name: nextPerson.name })}
                >
                  <Link href={`/people/${nextPerson.id}`}>
                    <CaretRightIcon aria-hidden="true" className="size-4" />
                    <span className="sr-only">
                      {t("detail.header.nextPerson", { name: nextPerson.name })}
                    </span>
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="hidden md:inline-flex">
                <PlusIcon aria-hidden="true" />
                {t("detail.buttons.addTransaction")}
                <CaretDownIcon aria-hidden="true" />
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
          <Button
            className="h-11 w-full sm:h-9 sm:w-auto"
            onClick={handleWhatsAppClick}
            title={phone ? undefined : t("detail.header.noPhone")}
          >
            <WhatsappLogoIcon aria-hidden="true" weight="fill" />
            {t("detail.header.whatsappButton")}
          </Button>
        </div>
      </div>

      <PeriodStepper
        className="sm:justify-center"
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
            <h2 className="font-heading text-sm font-semibold text-foreground">{t("detail.movements.title")}</h2>
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
          <Card className="gap-0 py-0">
            <div className="divide-y divide-border/60">
              {statement.movements.map((movement) => (
                <button
                  key={movement.id}
                  type="button"
                  onClick={() => handleRowClick(movement.id)}
                  disabled={isLoadingRow === movement.id}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-60"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="min-w-0 break-words text-sm font-medium">
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
          </Card>
        )}
      </div>

      {statement.cardSections.map((section) => (
        <div key={section.accountId} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="font-heading text-sm font-semibold text-foreground">{section.accountName}</h2>
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
              {section.isPaid && (
                <Badge
                  variant="outline"
                  className="border-positive/30 bg-positive/10 text-[10px] text-positive"
                >
                  {t("detail.invoices.paidBadge")}
                </Badge>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("detail.invoices.title", { month: periodLabel })}
            </span>
          </div>

          <Card className="gap-0 py-0">
            <div className="divide-y divide-border/60">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleRowClick(item.id)}
                  disabled={isLoadingRow === item.id}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-60"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="min-w-0 break-words text-sm font-medium">
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
          </Card>

          {/* Only when this person already settled part of this invoice
              (see `paid` in getPersonStatement) — otherwise the badge
              above already says everything there is to say. */}
          {(section.paid !== 0 || section.isPaid) && (
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
              <h2 className="font-heading text-sm font-semibold text-foreground">{t("detail.loans.title")}</h2>
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

          <Card className="gap-0 py-0">
            <div className="divide-y divide-border/60">
              {statement.loanItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="min-w-0 break-words text-sm font-medium">
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
          </Card>
        </div>
      )}

      {statement ? (
        <WhatsAppPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          statement={statement}
          period={period}
          phoneCountryCode={statement.person.phoneCountryCode}
          phone={statement.person.phone}
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
