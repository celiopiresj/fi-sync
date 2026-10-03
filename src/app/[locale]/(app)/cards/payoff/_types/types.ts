import type { getCardPayoffOptions } from "../actions";

export type CardPayoffOptions = Awaited<ReturnType<typeof getCardPayoffOptions>>;

// ---------------------------------------------------------------------
// computeCardPayoff's input — plain integer cents, already converted at
// the Prisma boundary (actions.ts), so the calculation itself never
// touches a Decimal or a float sum.
// ---------------------------------------------------------------------

// Signed, as stored: an expense (or a payment's settlement) is negative.
export type PayoffSplit = { personId: string; amountCents: number };

export type PayoffTransactionInput = {
  id: string;
  description: string;
  // "yyyy-MM-dd", read from the @db.Date column with dateOnlyKey.
  dateKey: string;
  amountCents: number;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  splits: PayoffSplit[];
};

export type PayoffInvoiceInput = {
  id: string;
  dueDateKey: string;
  card: { id: string; name: string };
  transactions: PayoffTransactionInput[];
  // The settlement splits of every payment already made against this
  // invoice — who each payment covered (see payInvoice).
  paymentSplits: PayoffSplit[];
  // Credit received from an earlier invoice's overpayment (positive).
  creditCents: number;
};

export type PayoffPerson = { id: string; name: string; isSelf: boolean };

// ---------------------------------------------------------------------
// computeCardPayoff's output — amounts back in reais.
// ---------------------------------------------------------------------

// One purchase (an installment group collapses into one row), or — kind
// "paid" — what was already paid on one invoice, so the rows always add
// up to the total shown above them.
export type PayoffItem = {
  key: string;
  kind: "purchase" | "paid";
  description: string;
  cardName: string;
  people: string[];
  isInstallment: boolean;
  firstNumber: number | null;
  lastNumber: number | null;
  installmentCount: number | null;
  remainingCount: number;
  installmentAmount: number;
  // "yyyy-MM" of the last invoice this row still lands on.
  lastMonth: string;
  total: number;
};

export type PayoffMonth = {
  monthKey: string;
  total: number;
  // Width of this month's bar relative to the biggest month (0–100).
  barPercent: number;
};

export type PayoffPersonTotal = {
  personId: string;
  name: string;
  isSelf: boolean;
  total: number;
};

export type PayoffCardTotal = { cardId: string; name: string; total: number };

// One line of the "Por pessoa"/"Por cartão" side cards.
export type PayoffBreakdownRow = {
  key: string;
  label: string;
  total: number;
  highlight?: boolean;
};

export type CardPayoff = {
  // The window actually used — the requested month, or the earliest
  // month with anything owed when none was requested.
  fromMonth: string | null;
  // Earliest/latest due month with anything owed, ignoring fromMonth —
  // the bounds of the "a partir de" stepper.
  firstMonth: string | null;
  lastMonth: string | null;
  total: number;
  selfTotal: number;
  othersTotal: number;
  othersCount: number;
  purchasesCount: number;
  parcelsCount: number;
  lastParcelMonth: string | null;
  months: PayoffMonth[];
  people: PayoffPersonTotal[];
  cards: PayoffCardTotal[];
  items: PayoffItem[];
};
