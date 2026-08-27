import { z } from "zod";

// Same positive-decimal grammar as transactions'/cards' own decimalString
// — duplicated per the _schema/actions-per-route convention (AGENTS.md).
const decimalString = z
  .string()
  .min(1)
  .transform((value) => Number(value.replace(",", ".")))
  .pipe(z.number().positive());

// One person's share of a payment — used only when the entered
// paidAmount differs from what's currently due (see refinePayInvoice
// below), replacing the automatic proportional split with a manual one.
// Same shape as transactions' own splitSchema.
export const invoiceAllocationSchema = z.object({
  personId: z.string().min(1),
  amount: decimalString,
});

// `accountId` is which checking/savings/cash account the payment comes
// out of — paying a card invoice creates an expense Transaction there
// (see payInvoice in actions.ts), same spirit as a transfer. `paidAt`
// is a date-only "yyyy-MM-dd" string (native `<input type="date">`/
// DateField shape), parsed with parseCalendarDate at the write boundary
// — never trust/construct a raw `new Date()` from it (see AGENTS.md's
// "Date values" convention). `allocations` is only required (see
// refinePayInvoice) when paidAmount doesn't exactly match the invoice's
// current remaining due amount — otherwise it's ignored and the server
// auto-splits proportionally across everyone still owed, same as this
// app always did before partial payments existed.
export const payInvoiceSchema = z.object({
  paidAmount: decimalString,
  accountId: z.string().min(1),
  paidAt: z.string().min(1),
  allocations: z.array(invoiceAllocationSchema),
});

export type PayInvoiceFormValues = z.input<typeof payInvoiceSchema>;
export type PayInvoiceValues = z.output<typeof payInvoiceSchema>;

export const emptyPayInvoiceFormValues: PayInvoiceFormValues = {
  paidAmount: "",
  accountId: "",
  paidAt: "",
  allocations: [],
};

// Cross-field check that can't live in the static schema above — needs
// the invoice's own live remainingDue, known only at the call site, not
// something the static shape can encode. Applied via `superRefine`,
// called from both the client dialog and the Server Action so the rule
// can't drift between the two — same convention as transactions'
// refineDebitTransaction/refineCreditTransaction. Messages are passed in
// already-translated (AGENTS.md: no hardcoded/default UI text).
export function refinePayInvoice(
  data: PayInvoiceValues,
  ctx: z.RefinementCtx,
  options: {
    remainingDueCents: number;
    messages: {
      allocationsRequired: string;
      allocationsMismatch: string;
    };
  },
) {
  const paidCents = Math.round(data.paidAmount * 100);
  // Paying exactly what's due keeps today's automatic proportional split
  // — no manual allocation needed, `allocations` is ignored either way.
  if (paidCents === options.remainingDueCents) return;

  // Anything beyond remainingDue becomes next-invoice credit (payInvoice
  // handles that server-side) and isn't owed by anyone specific, so the
  // manual allocation only ever needs to cover up to remainingDue, not
  // the raw paidAmount.
  const coveredCents = Math.min(paidCents, options.remainingDueCents);

  if (data.allocations.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["allocations"],
      message: options.messages.allocationsRequired,
    });
    return;
  }

  const allocatedCents = data.allocations.reduce(
    (sum, allocation) => sum + Math.round(allocation.amount * 100),
    0,
  );
  if (Math.abs(allocatedCents - coveredCents) > 1) {
    ctx.addIssue({
      code: "custom",
      path: ["allocations"],
      message: options.messages.allocationsMismatch,
    });
  }
}

// Never persisted as "CLOSED" on Invoice.status itself (tasks/013.md's
// User Review Required answer — no background job exists to write that
// transition, see Recurrence's own "no background job" limitation) —
// this is purely a derived, display-only value computed in actions.ts's
// listInvoices/getInvoiceDetail from `closingDate` vs. today, with
// `PARTIALLY_PAID`/`PAID` taking precedence once real payments/credit
// exist (see recomputeInvoiceStatus, src/lib/invoice-total.ts, which is
// what actually decides between those two).
export const invoiceDisplayStatusValues = [
  "OPEN",
  "CLOSED",
  "PARTIALLY_PAID",
  "PAID",
] as const;
export type InvoiceDisplayStatus = (typeof invoiceDisplayStatusValues)[number];

export type InvoiceSheetFilters = {
  accountId?: string;
  status?: InvoiceDisplayStatus | "all";
};
