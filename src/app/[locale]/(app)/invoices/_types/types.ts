import type {
  listInvoices,
  getInvoiceDetail,
  getInvoiceFormOptions,
  getPayableAccounts,
} from "../actions";

export type InvoiceRow = Awaited<ReturnType<typeof listInvoices>>[number];
export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoiceDetail>>>;
export type InvoiceTransactionRow = InvoiceDetail["transactions"][number];
export type InvoiceFormOptions = Awaited<ReturnType<typeof getInvoiceFormOptions>>;
export type InvoiceAccountOption = InvoiceFormOptions["accounts"][number];

// The checking/savings/cash accounts a payment can be debited from — a
// different set (and a different screen's worth of options) from
// InvoiceAccountOption above, which is CREDIT_CARD accounts for the list
// filter.
export type PayableAccountOption = Awaited<
  ReturnType<typeof getPayableAccounts>
>[number];

// Which calendar month the invoices list's period stepper is showing —
// scopes listInvoices' closingDate filter (see invoices/_lib/period.ts).
export type InvoicePeriod = { year: number; month: number };
