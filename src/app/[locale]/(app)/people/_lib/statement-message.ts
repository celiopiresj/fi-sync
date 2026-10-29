import { DATE_ONLY_FORMAT_OPTIONS, parseCalendarDate } from "@/lib/date";
import { buildStatementMessage, getGreetingPeriod } from "./whatsapp-message";
import type { PersonStatement, StatementPeriod } from "../_types/types";

type Translate = (key: string, values?: Record<string, string | number>) => string;
type Formatter = {
  number: (value: number, options?: Record<string, unknown>) => string;
  dateTime: (value: Date, options?: Record<string, unknown>) => string;
};

export type StatementMessageFilter = {
  selectedMovementIds?: Set<string>;
  selectedCardItemIds?: Set<string>;
  selectedLoanItemIds?: Set<string>;
};

// Builds the exact WhatsApp message text for a person's statement — the
// one shared implementation behind both the person detail page's "Enviar
// via WhatsApp" button and the people list's "Cobrar" shortcut, so the two
// entry points can never drift apart.
export function buildPersonStatementMessage(
  statement: NonNullable<PersonStatement>,
  period: StatementPeriod,
  t: Translate,
  format: Formatter,
  filter?: StatementMessageFilter,
): string {
  const money = (value: number) =>
    format.number(value, { style: "currency", currency: "BRL" });

  const periodLabelDate = parseCalendarDate(
    `${period.year}-${String(period.month + 1).padStart(2, "0")}-01`,
  );
  const periodLabel = format.dateTime(periodLabelDate, {
    year: "numeric",
    month: "long",
  });

  const movementsRangeLabel = t(
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
  );

  // Visible movements: hiding a movement omits its line from the message,
  // but statement.balance intentionally remains unchanged.
  const visibleMovements = filter?.selectedMovementIds
    ? statement.movements.filter((m) => filter.selectedMovementIds!.has(m.id))
    : statement.movements;

  // Include all card sections from the statement so that even for previous
  // months whose invoices are already paid, the user can still detail the
  // invoice items on WhatsApp.
  const visibleInvoiceItemsWithRaw = statement.cardSections.flatMap((section) => {
    const items = filter?.selectedCardItemIds
      ? section.items.filter((item) => filter.selectedCardItemIds!.has(item.id))
      : section.items;
    return items.map((item) => ({
      raw: item,
      section,
      line: {
        label: item.description,
        valueLine: [
          // Real signed amount, not Math.abs — a refund/reversal on the
          // card (positive) must read differently from a normal charge
          // (negative) here too, same fix as person-detail-view.tsx's
          // own on-screen list.
          money(item.amount),
          format.dateTime(item.date, DATE_ONLY_FORMAT_OPTIONS),
          item.installmentCount && item.installmentCount > 1
            ? t("detail.invoices.installment", {
                number: item.installmentNumber ?? 0,
                count: item.installmentCount,
              })
            : t("detail.invoices.cash"),
        ].join(" - "),
      },
    }));
  });

  // Hiding card items recalculates the invoice total based only on the
  // visible items.
  const visibleCardTotal = visibleInvoiceItemsWithRaw.reduce(
    (sum, entry) => sum + entry.raw.amount,
    0,
  );

  // For totalToSettle:
  // Paid invoice items are ALREADY settled into statement.balance (via the
  // payment transaction split created when the user paid the invoice).
  // Only UNPAID invoice items contribute to the pending card amount, preventing
  // double counting on already-settled periods.
  const pendingCardContribution = visibleInvoiceItemsWithRaw
    .filter((entry) => !entry.section.isPaid)
    .reduce((sum, entry) => sum + entry.raw.amount, 0);

  const visibleLoanItems = filter?.selectedLoanItemIds
    ? statement.loanItems.filter((item) => filter.selectedLoanItemIds!.has(item.id))
    : statement.loanItems;
  const visibleLoanTotal = visibleLoanItems.reduce((sum, item) => sum + item.amount, 0);

  // Final settlement total calculation:
  // - statement.balance is preserved even if movements are hidden
  // - unpaid card items sum only visible transactions
  // - loan items sum only visible items
  const effectiveTotalToSettle =
    statement.balance + pendingCardContribution - visibleLoanTotal;

  // Dynamic final label:
  // - If person owes user (effectiveTotalToSettle < 0): "Resta"
  // - If user owes person (effectiveTotalToSettle > 0): "Saldo na conta" or "Saldo a transferir"
  // - If zero: "Saldo quitado"
  let totalLabel: string;
  if (effectiveTotalToSettle < -0.005) {
    totalLabel = t("detail.whatsapp.remainingLabel");
  } else if (effectiveTotalToSettle > 0.005) {
    totalLabel =
      visibleInvoiceItemsWithRaw.length === 0 && visibleLoanItems.length === 0
        ? t("detail.whatsapp.balanceInAccountLabel")
        : t("detail.whatsapp.balanceToPayLabel");
  } else {
    totalLabel = t("detail.whatsapp.settledLabel");
  }

  return buildStatementMessage({
    greeting: t(`detail.whatsapp.greeting.${getGreetingPeriod(new Date())}`),
    title: t("detail.whatsapp.messageTitle"),
    balanceLine: `${t("detail.summary.balance")}: ${money(statement.balance)}`,
    movementsSectionTitle: `${t("detail.movements.title")} (${movementsRangeLabel})`,
    movements: visibleMovements.map((movement) => ({
      label: movement.description,
      valueLine: `${money(movement.amount)} - ${format.dateTime(movement.date, DATE_ONLY_FORMAT_OPTIONS)}`,
    })),
    invoiceSectionTitle: t("detail.invoices.title", { month: periodLabel }),
    invoiceItems: visibleInvoiceItemsWithRaw.map((entry) => entry.line),
    invoiceTotalLine:
      visibleInvoiceItemsWithRaw.length > 0
        ? `${t("detail.invoices.total")}: ${money(Math.abs(visibleCardTotal))}`
        : null,
    loanSectionTitle: t("detail.loans.title"),
    loanItems: visibleLoanItems.map((item) => ({
      label: item.description,
      valueLine: [
        money(item.amount),
        format.dateTime(item.date, DATE_ONLY_FORMAT_OPTIONS),
        item.installmentCount && item.installmentCount > 1
          ? t("detail.invoices.installment", {
              number: item.installmentNumber ?? 0,
              count: item.installmentCount,
            })
          : t("detail.invoices.cash"),
      ].join(" - "),
    })),
    loanTotalLine:
      visibleLoanItems.length > 0
        ? `${t("detail.loans.total")}: ${money(visibleLoanTotal)}`
        : null,
    totalLine: `${totalLabel}: ${money(Math.abs(effectiveTotalToSettle))}`,
  });
}
