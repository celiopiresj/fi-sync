import { DATE_ONLY_FORMAT_OPTIONS, parseCalendarDate } from "@/lib/date";
import { buildStatementMessage, getGreetingPeriod } from "./whatsapp-message";
import type { PersonStatement, StatementPeriod } from "../_types/types";

type Translate = (key: string, values?: Record<string, string | number>) => string;
type Formatter = {
  number: (value: number, options?: Record<string, unknown>) => string;
  dateTime: (value: Date, options?: Record<string, unknown>) => string;
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

  // Only unpaid invoices count as "pending" — a paid one's items already
  // rolled into statement.balance (see getPersonStatement in actions.ts),
  // so surfacing them again here would double them up.
  const pendingCardSections = statement.cardSections.filter(
    (section) => !section.isPaid,
  );

  return buildStatementMessage({
    greeting: t(`detail.whatsapp.greeting.${getGreetingPeriod(new Date())}`),
    title: t("detail.whatsapp.messageTitle"),
    balanceLine: `${t("detail.summary.balance")}: ${money(statement.balance)}`,
    movementsSectionTitle: `${t("detail.movements.title")} (${movementsRangeLabel})`,
    movements: statement.movements.map((movement) => ({
      label: movement.description,
      valueLine: `${money(movement.amount)} - ${format.dateTime(movement.date, DATE_ONLY_FORMAT_OPTIONS)}`,
    })),
    invoiceSectionTitle: t("detail.invoices.title", { month: periodLabel }),
    invoiceItems: pendingCardSections.flatMap((section) =>
      section.items.map((item) => ({
        label: item.description,
        valueLine: [
          money(Math.abs(item.amount)),
          format.dateTime(item.date, DATE_ONLY_FORMAT_OPTIONS),
          item.installmentCount && item.installmentCount > 1
            ? t("detail.invoices.installment", {
                number: item.installmentNumber ?? 0,
                count: item.installmentCount,
              })
            : t("detail.invoices.cash"),
        ].join(" - "),
      })),
    ),
    invoiceTotalLine:
      pendingCardSections.length > 0
        ? `${t("detail.invoices.total")}: ${money(Math.abs(statement.pendingCardTotal))}`
        : null,
    loanSectionTitle: t("detail.loans.title"),
    loanItems: statement.loanItems.map((item) => ({
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
      statement.loanItems.length > 0
        ? `${t("detail.loans.total")}: ${money(statement.pendingLoanTotal)}`
        : null,
    totalLine: `${t("detail.whatsapp.remainingLabel")}: ${money(Math.abs(statement.totalToSettle))}`,
  });
}
