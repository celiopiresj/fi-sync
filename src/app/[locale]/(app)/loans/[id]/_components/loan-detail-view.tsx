"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DATE_ONLY_FORMAT_OPTIONS } from "@/lib/date";
import { undoLoanPayment } from "../../actions";
import {
  LoanStatusBadge,
  loanStatusMessageKey,
} from "../../_components/loan-status-badge";
import { RegisterPaymentDialog } from "./register-payment-dialog";
import { SettleLoanDialog } from "./settle-loan-dialog";
import type { LoanAccountOption, LoanDetail, LoanInstallmentRow } from "../../_types/types";

type LoanDetailViewProps = {
  loan: LoanDetail;
  accounts: LoanAccountOption[];
};

// Derived the same way listLoans computes it server-side (see
// LoanStatus in actions.ts), just from the single detail record instead
// of a list row.
function loanStatus(loan: LoanDetail): "ON_TRACK" | "OVERDUE" | "SETTLED" {
  const pending = loan.installments.filter((i) => !i.isPaid);
  if (pending.length === 0) return "SETTLED";
  return pending.some((i) => i.isOverdue) ? "OVERDUE" : "ON_TRACK";
}

export function LoanDetailView({ loan, accounts }: LoanDetailViewProps) {
  const t = useTranslations("scrn-loans");
  const format = useFormatter();
  const router = useRouter();
  const [payingInstallment, setPayingInstallment] = useState<LoanInstallmentRow | null>(
    null,
  );
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);

  function money(value: number) {
    return format.number(value, { style: "currency", currency: "BRL" });
  }

  function handlePaid() {
    setPayingInstallment(null);
    router.refresh();
  }

  function handleSettled() {
    setSettling(false);
    router.refresh();
  }

  async function handleUndo(installment: LoanInstallmentRow) {
    setUndoingId(installment.id);
    const result = await undoLoanPayment(installment.id);
    setUndoingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(t("payment.toast.undone"));
    router.refresh();
  }

  const status = loanStatus(loan);
  const totalAmount = loan.paidTotal + loan.remainingTotal;
  const pendingCount = loan.installments.filter((i) => !i.isPaid).length;

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6">
      <Link
        href="/loans"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("detail.back")}
      </Link>

      <div className="flex flex-col gap-4 rounded-lg bg-surface-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold">{loan.person.name}</h1>
            <p className="text-sm text-muted-foreground">{loan.description}</p>
          </div>
          <LoanStatusBadge
            status={status}
            label={t(`status.${loanStatusMessageKey(status)}`)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("card.remaining")}</span>
          <span className="text-[28px] font-medium tabular-nums text-negative">
            {money(loan.remainingTotal)}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {t("detail.summary.total")}{" "}
            <span className="font-medium text-foreground">{money(totalAmount)}</span>
          </span>
          <span>
            {t("detail.summary.paidSoFar")}{" "}
            <span className="font-medium text-positive">{money(loan.paidTotal)}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">{t("detail.installments.title")}</h2>
          {loan.canSettleRemaining && (
            <Button variant="outline" size="sm" onClick={() => setSettling(true)}>
              {t("payment.settle.button")}
            </Button>
          )}
        </div>

        <div className="rounded-md border border-border">
          <div className="divide-y divide-border">
            {loan.installments.map((installment) => {
              // Only ever set once paid, and only ever different from
              // `amount` when an interest/discount adjustment applied at
              // payment time (see getLoanDetail, actions.ts).
              const hasAdjustment =
                installment.paidAmount !== null &&
                installment.paidAmount !== installment.amount;

              return (
                <div
                  key={installment.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {t("detail.installments.row", {
                        number: installment.installmentNumber,
                        count: installment.installmentCount,
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format.dateTime(installment.dueDate, DATE_ONLY_FORMAT_OPTIONS)}
                      {hasAdjustment &&
                        ` · ${t("detail.installments.nominalAmount", { amount: money(installment.amount) })}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium tabular-nums">
                      {money(hasAdjustment ? installment.paidAmount! : installment.amount)}
                    </span>

                    {installment.isPaid ? (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-positive/30 bg-positive/10 text-positive"
                        >
                          <CheckCircleIcon weight="fill" className="size-3.5" />
                          {t("detail.installments.paid")}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={undoingId === installment.id}
                          onClick={() => handleUndo(installment)}
                        >
                          {t("detail.installments.undo")}
                        </Button>
                      </div>
                    ) : (
                      <>
                        {installment.isOverdue ? (
                          <Badge
                            variant="outline"
                            className="border-negative/30 bg-negative/10 text-negative"
                          >
                            {t("status.overdue")}
                          </Badge>
                        ) : null}
                        <Button
                          size="sm"
                          onClick={() => setPayingInstallment(installment)}
                        >
                          {t("detail.installments.registerPayment")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {payingInstallment ? (
        <RegisterPaymentDialog
          open={payingInstallment !== null}
          onOpenChange={(open) => {
            if (!open) setPayingInstallment(null);
          }}
          installment={payingInstallment}
          accounts={accounts}
          onPaid={handlePaid}
        />
      ) : null}

      {settling ? (
        <SettleLoanDialog
          open={settling}
          onOpenChange={setSettling}
          loanId={loan.id}
          pendingCount={pendingCount}
          remainingTotal={loan.remainingTotal}
          accounts={accounts}
          onSettled={handleSettled}
        />
      ) : null}
    </div>
  );
}
