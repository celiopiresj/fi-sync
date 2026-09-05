import { z } from "zod";

// Same positive-decimal grammar as every other route's own decimalString
// — duplicated per the _schema/actions-per-route convention (AGENTS.md).
const decimalString = z
  .string()
  .min(1)
  .transform((value) => Number(value.replace(",", ".")))
  .pipe(z.number().positive());

const installmentCountString = z
  .string()
  .min(1)
  .transform((value) => Number(value))
  .pipe(z.number().int().min(1).max(60));

// `dueDate` is the FIRST installment's due date — every following one is
// a month later (see computeLoanInstallmentDates in actions.ts). Every
// installment gets the exact same `installmentAmount` the user types —
// no total-split/remainder math, unlike a credit card purchase's own
// installments. `receivedAmount`/`receivedAccountId` are optional: left
// empty, nothing extra happens; filled in, createLoan also posts a
// one-time income Transaction for the money actually received when the
// loan started (see refineLoanReceived below for the cross-field rule).
export const loanSchema = z.object({
  personId: z.string().min(1),
  description: z.string().min(1),
  installmentAmount: decimalString,
  installments: installmentCountString,
  dueDate: z.string().min(1),
  receivedAmount: z.string(),
  receivedAccountId: z.string(),
});

export type LoanFormValues = z.input<typeof loanSchema>;
export type LoanValues = z.output<typeof loanSchema>;

export const emptyLoanFormValues: LoanFormValues = {
  personId: "",
  description: "",
  installmentAmount: "",
  installments: "1",
  dueDate: "",
  receivedAmount: "",
  receivedAccountId: "",
};

// Cross-field check the static shape above can't encode on its own:
// `receivedAmount` and `receivedAccountId` are only meaningful together
// — filling in one without the other leaves createLoan unable to know
// which account the money landed in (or what amount to post). Applied
// via `superRefine`, same convention as invoices' own refinePayInvoice —
// messages passed in already-translated (AGENTS.md: no hardcoded UI
// text), called from both the create dialog and the Server Action so
// the rule can't drift between the two.
export function refineLoanReceived(
  data: LoanValues,
  ctx: z.RefinementCtx,
  messages: { accountRequired: string },
) {
  if (!data.receivedAmount) return;
  if (!data.receivedAccountId) {
    ctx.addIssue({
      code: "custom",
      path: ["receivedAccountId"],
      message: messages.accountRequired,
    });
  }
}

// The user types what actually got paid — not an interest/discount
// figure on top of the nominal amount. Comparing this against the
// installment's own `amount` (or, from settleRemainingLoanInstallments,
// the summed remaining balance) is what tells apart "paid more than
// owed" (interest/late fee) from "paid less" (an early-payment discount)
// — see classifyLoanPaymentAdjustment (_lib/loan-payment.ts), used by
// both the payment dialogs' preview and the Server Actions that post the
// settlement Transaction(s). Reuses the app's standard positive-decimal
// grammar, so "required"/"invalid" errors come translated for free from
// the shared zod error map (src/lib/zod/zod-error-map.ts) — no
// installment-specific cross-field rule needed here at all, unlike
// refineLoanReceived above.
export const registerLoanPaymentSchema = z.object({
  accountId: z.string().min(1),
  paidAt: z.string().min(1),
  paidAmount: decimalString,
});

export type RegisterLoanPaymentFormValues = z.input<
  typeof registerLoanPaymentSchema
>;
export type RegisterLoanPaymentValues = z.output<
  typeof registerLoanPaymentSchema
>;

export const emptyRegisterLoanPaymentFormValues: RegisterLoanPaymentFormValues =
  {
    accountId: "",
    paidAt: "",
    paidAmount: "",
  };
