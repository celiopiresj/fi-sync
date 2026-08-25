import type { TransactionRow } from "../_types/types";

// Combines a credit-card row's physical card name with its installment
// state ("2/3", or "À vista" for a one-off charge) into a single
// subtitle segment — shared by the desktop table (table/columns.tsx)
// and the mobile list (table/transaction-mobile-list.tsx) so the two
// wordings can't drift apart. Returns null for a non-credit-card row
// (no transactionCard at all — a debit transaction never has one).
export function creditCardDetail(
  row: Pick<TransactionRow, "transactionCard" | "installmentNumber" | "installmentCount">,
  messages: {
    installmentLabel: (number: number, count: number) => string;
    oneTimePaymentLabel: string;
  },
): string | null {
  if (!row.transactionCard) return null;

  const installment =
    row.installmentCount && row.installmentCount > 1 && row.installmentNumber
      ? messages.installmentLabel(row.installmentNumber, row.installmentCount)
      : messages.oneTimePaymentLabel;

  return `${row.transactionCard.card.name} · ${installment}`;
}
