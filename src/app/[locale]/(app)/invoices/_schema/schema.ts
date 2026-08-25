import { z } from "zod";

// Same positive-decimal grammar as transactions'/cards' own decimalString
// — duplicated per the _schema/actions-per-route convention (AGENTS.md).
const decimalString = z
  .string()
  .min(1)
  .transform((value) => Number(value.replace(",", ".")))
  .pipe(z.number().positive());

// `accountId` is which checking/savings/cash account the payment comes
// out of — paying a card invoice creates an expense Transaction there
// (see markInvoicePaid in actions.ts), same spirit as a transfer. `paidAt`
// is a date-only "yyyy-MM-dd" string (native `<input type="date">`/
// DateField shape), parsed with parseCalendarDate at the write boundary
// — never trust/construct a raw `new Date()` from it (see AGENTS.md's
// "Date values" convention).
export const markInvoicePaidSchema = z.object({
  paidAmount: decimalString,
  accountId: z.string().min(1),
  paidAt: z.string().min(1),
});

export type MarkInvoicePaidFormValues = z.input<typeof markInvoicePaidSchema>;
export type MarkInvoicePaidValues = z.output<typeof markInvoicePaidSchema>;

export const emptyMarkInvoicePaidFormValues: MarkInvoicePaidFormValues = {
  paidAmount: "",
  accountId: "",
  paidAt: "",
};

// Never persisted as "CLOSED" on Invoice.status itself (tasks/013.md's
// User Review Required answer — no background job exists to write that
// transition, see Recurrence's own "no background job" limitation) —
// this is purely a derived, display-only value computed in actions.ts's
// listInvoices/getInvoiceDetail from `closingDate` vs. today, with `PAID`
// taking precedence once the user explicitly marks it.
export const invoiceDisplayStatusValues = ["OPEN", "CLOSED", "PAID"] as const;
export type InvoiceDisplayStatus = (typeof invoiceDisplayStatusValues)[number];

export type InvoiceSheetFilters = {
  accountId?: string;
  status?: InvoiceDisplayStatus | "all";
};
