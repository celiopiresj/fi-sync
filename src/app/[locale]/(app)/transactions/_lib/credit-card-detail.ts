import type { TransactionRow } from "../_types/types";

// Combines a credit-card row's physical card name, installment state
// ("2/3", or "À vista" for a one-off charge), and real purchase date
// into a single subtitle segment — shared by the desktop table
// (table/columns.tsx) and the mobile list (table/transaction-mobile-list.tsx)
// so the wordings can't drift apart. Returns null for a non-credit-card
// row (no transactionCard at all — a debit transaction never has one).
// The purchase date is needed here (not just shown via the row's own
// date column) because a credit row's primary "date" — the one it's
// grouped/filtered by — is its invoice's due date, not this one; the
// real purchase date only survives here, in the subtitle.
export function creditCardDetail(
  row: Pick<TransactionRow, "transactionCard" | "installmentNumber" | "installmentCount">,
  messages: {
    installmentLabel: (number: number, count: number) => string;
    oneTimePaymentLabel: string;
  },
  purchaseDateLabel: string,
): string | null {
  if (!row.transactionCard) return null;

  const installment =
    row.installmentCount && row.installmentCount > 1 && row.installmentNumber
      ? messages.installmentLabel(row.installmentNumber, row.installmentCount)
      : messages.oneTimePaymentLabel;

  return `${row.transactionCard.card.name} · ${installment} · ${purchaseDateLabel}`;
}
