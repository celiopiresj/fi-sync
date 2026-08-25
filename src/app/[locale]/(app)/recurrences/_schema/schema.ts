import { z } from "zod";
import { evaluateExpression } from "@/lib/math/safe-expression";

export const recurrenceTypeValues = ["income", "expense"] as const;
export type RecurrenceType = (typeof recurrenceTypeValues)[number];

// Matches the Prisma `RecurrenceFrequency` enum (DAILY/WEEKLY/MONTHLY) —
// unlike transactions' own recurrenceFrequencyValues (_schema/schema.ts
// under transactions/), there's no "none" option here: every row on this
// screen already IS a recurrence, so "not recurring" isn't a choice a
// user makes from this form.
export const recurrenceFrequencyValues = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type RecurrenceFrequencyValue = (typeof recurrenceFrequencyValues)[number];

// Same fixed set as the Prisma `PaymentMethod` enum, duplicated rather
// than imported from transactions' own _schema/schema.ts (private,
// per-route folder — see the amountString/decimalString comments below).
export const paymentMethodValues = [
  "CASH",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "PIX",
  "BOLETO",
  "OTHER",
] as const;
export type PaymentMethodOption = (typeof paymentMethodValues)[number];

// CREDIT_CARD doesn't belong among the debit form's own choices — a
// credit-card recurrence goes through creditRecurrenceContentSchema
// below instead (its own account picker, cardId always required), same
// split as transactions' own debit/credit schemas (tasks/015.md).
export const paymentMethodFormValues = paymentMethodValues.filter(
  (method) => method !== "CREDIT_CARD",
);

// Same amount grammar as the transactions form — comma/period decimal,
// or a `+ - * /` expression like "120+35" (see fields.amount.help) —
// duplicated rather than imported from transactions/_schema/schema.ts
// since _schema is a private, per-route folder (AGENTS.md).
const amountString = z
  .string()
  .min(1)
  .transform((value) => {
    const evaluated = evaluateExpression(value);
    if (evaluated !== null) return evaluated;
    return Number(value.replace(",", "."));
  })
  .pipe(z.number().positive());

// Split amounts, unlike the top-level `amount` above, are plain decimals
// only (no expressions) — same convention and same duplication rationale
// as transactions' own decimalString in _schema/schema.ts.
const decimalString = z
  .string()
  .min(1)
  .transform((value) => Number(value.replace(",", ".")))
  .pipe(z.number().positive());

const splitSchema = z.object({
  personId: z.string().min(1),
  amount: decimalString,
});

// ---------------------------------------------------------------------
// Debit / everyday recurrences — cash, Pix, debit card, transfer,
// boleto. No card, since none of that applies to money that leaves the
// account immediately. Same split as transactions/_schema/schema.ts's
// own debitTransactionSchema/creditTransactionSchema (tasks/015.md).
// ---------------------------------------------------------------------

// Fields editable both at creation and later via edit — the "content" of
// a recurrence, as opposed to its schedule (frequency/startDate below),
// which the create-only schema adds. Editing these cascades to the still-
// future/pending occurrences already generated for the rule — see
// updateDebitRecurrence in actions.ts.
export const debitRecurrenceContentSchema = z.object({
  type: z.enum(recurrenceTypeValues),
  amount: amountString,
  description: z.string().min(1),
  accountId: z.string().min(1),
  categoryId: z.string(),
  // Required (enforced in refineDebitRecurrence below) — but the zod
  // field itself still allows "" (`z.enum(["", ...paymentMethodValues])`,
  // not this type directly) so the field has a valid value to start from
  // before the user picks one. Same convention as transactions' own
  // paymentMethod field.
  paymentMethod: z.enum(["", ...paymentMethodValues]),
  // Every recurrence is attributed to someone — unlike transactions'
  // own optional personId, this one IS `.min(1)` directly (a plain
  // string field, so `.min(1)` alone is enough to get a translated
  // "required" message through the shared zod error map, no superRefine
  // needed for this part).
  personId: z.string().min(1),
  // Only populated while "Dividir com outras pessoas" is active —
  // splits[0] is the "Pagou" row (mirrors personId above), splits[1+]
  // are "Deve" rows. Empty otherwise: the recurrence is attributed to
  // `personId` alone. Same reconciliation as transactions' own
  // personId/splits pair — see resolveSplitsCreateInput in actions.ts.
  splits: z.array(splitSchema),
  // "" = no end date (recurs indefinitely) — see the Recurrence.endDate
  // doc comment in prisma/schema.prisma. Editable after creation (unlike
  // frequency/startDate below): shortening it cascades to delete any
  // already-generated future/PENDING occurrences dated past the new
  // cutoff (see updateDebitRecurrence in actions.ts); lengthening it, or
  // clearing it back to indefinite, just lifts the ceiling for the next
  // extendRecurrenceGeneration call — nothing is generated immediately
  // by the edit itself.
  endDate: z.string(),
});

export type DebitRecurrenceContentFormValues = z.input<
  typeof debitRecurrenceContentSchema
>;
export type DebitRecurrenceContentValues = z.output<
  typeof debitRecurrenceContentSchema
>;

// Schedule fields, only ever asked for at creation. Frequency/startDate
// stay immutable once occurrences are generated — changing them after
// the fact would mean reconciling an already-materialized batch of
// Transaction rows against a new shape, which is out of scope here
// (endDate doesn't have this problem — see the comment on it above — so
// it lives on debitRecurrenceContentSchema instead, editable). To get a
// different frequency/startDate, delete the rule and create a new one.
export const debitRecurrenceCreateSchema = debitRecurrenceContentSchema.extend({
  frequency: z.enum(recurrenceFrequencyValues),
  startDate: z.string().min(1),
});

export type DebitRecurrenceCreateFormValues = z.input<
  typeof debitRecurrenceCreateSchema
>;
export type DebitRecurrenceCreateValues = z.output<
  typeof debitRecurrenceCreateSchema
>;

export const emptyDebitRecurrenceContentValues: DebitRecurrenceContentFormValues = {
  type: "expense",
  amount: "",
  description: "",
  accountId: "",
  categoryId: "",
  paymentMethod: "",
  personId: "",
  splits: [],
  endDate: "",
};

export const emptyDebitRecurrenceCreateValues: DebitRecurrenceCreateFormValues = {
  ...emptyDebitRecurrenceContentValues,
  frequency: "MONTHLY",
  startDate: "",
};

// Cross-field checks that can't live in the static schema above — called
// from both the client validator and the Server Action so the rules
// can't drift between the two. Typed against DebitRecurrenceContentValues
// rather than DebitRecurrenceCreateValues so the identical checks apply
// to both the create and edit schemas without duplicating this function
// — a DebitRecurrenceCreateValues object (which extends content with
// frequency/startDate) satisfies this shape structurally.
export function refineDebitRecurrence(
  data: DebitRecurrenceContentValues,
  ctx: z.RefinementCtx,
  messages: {
    paymentMethodRequired: string;
    splitsMismatch: string;
  },
) {
  if (!data.paymentMethod) {
    ctx.addIssue({
      code: "custom",
      path: ["paymentMethod"],
      message: messages.paymentMethodRequired,
    });
  }

  // Splits are optional (see the personId/splits comments above) — an
  // empty array just means "not divided," not an error. When present,
  // though, they must add up to the recurrence's total amount.
  if (data.splits.length > 0) {
    const total = data.splits.reduce((sum, split) => sum + split.amount, 0);
    if (Math.abs(total - data.amount) > 0.01) {
      ctx.addIssue({
        code: "custom",
        path: ["splits"],
        message: messages.splitsMismatch,
      });
    }
  }
}

// ---------------------------------------------------------------------
// Credit card recurrences — always tied to a physical card. No
// installments here (unlike a one-off credit-card purchase in
// transactions/_schema/schema.ts): a recurrence already repeats the full
// amount every cycle on its own, so "split this charge into N
// installments" doesn't apply the same way.
// ---------------------------------------------------------------------

// The account picker only ever offers CREDIT_CARD accounts (see
// getRecurrenceFormOptions/CreditRecurrenceForm), so unlike
// debitRecurrenceContentSchema's own accountId, this one is always
// paired with a required cardId directly in the static schema — no
// runtime account-type check needed. No `paymentMethod` either: it's
// implicitly "credit card".
export const creditRecurrenceContentSchema = z.object({
  type: z.enum(recurrenceTypeValues),
  amount: amountString,
  description: z.string().min(1),
  accountId: z.string().min(1),
  categoryId: z.string(),
  cardId: z.string().min(1),
  personId: z.string().min(1),
  splits: z.array(splitSchema),
  endDate: z.string(),
});

export type CreditRecurrenceContentFormValues = z.input<
  typeof creditRecurrenceContentSchema
>;
export type CreditRecurrenceContentValues = z.output<
  typeof creditRecurrenceContentSchema
>;

export const creditRecurrenceCreateSchema = creditRecurrenceContentSchema.extend({
  frequency: z.enum(recurrenceFrequencyValues),
  startDate: z.string().min(1),
});

export type CreditRecurrenceCreateFormValues = z.input<
  typeof creditRecurrenceCreateSchema
>;
export type CreditRecurrenceCreateValues = z.output<
  typeof creditRecurrenceCreateSchema
>;

export const emptyCreditRecurrenceContentValues: CreditRecurrenceContentFormValues = {
  type: "expense",
  amount: "",
  description: "",
  accountId: "",
  categoryId: "",
  cardId: "",
  personId: "",
  splits: [],
  endDate: "",
};

export const emptyCreditRecurrenceCreateValues: CreditRecurrenceCreateFormValues = {
  ...emptyCreditRecurrenceContentValues,
  frequency: "MONTHLY",
  startDate: "",
};

// Cross-field checks for the credit form — just the splits-total check,
// same convention as refineDebitRecurrence above; no cardRequired branch
// needed since cardId is already `.min(1)` in the static schema (this
// form's account picker never offers a non-credit-card account to begin
// with, so there's no runtime ambiguity to catch here).
export function refineCreditRecurrence(
  data: CreditRecurrenceContentValues,
  ctx: z.RefinementCtx,
  messages: {
    splitsMismatch: string;
  },
) {
  if (data.splits.length > 0) {
    const total = data.splits.reduce((sum, split) => sum + split.amount, 0);
    if (Math.abs(total - data.amount) > 0.01) {
      ctx.addIssue({
        code: "custom",
        path: ["splits"],
        message: messages.splitsMismatch,
      });
    }
  }
}

// The subset of RecurrenceFilters that FiltersSheet itself edits — same
// split as transactions' SheetFilters (_types/types.ts): the search
// input lives outside the sheet, owned directly by recurrences-view.tsx.
// No period/date range here at all (unlike transactions) — recurrences
// are continuous, not scoped to a month, per tasks/012.md's "User Review
// Required" note.
export type RecurrenceSheetFilters = {
  accountId?: string;
  categoryId?: string;
  type?: "all" | "income" | "expenses";
  status?: "active" | "finished" | "all";
};
