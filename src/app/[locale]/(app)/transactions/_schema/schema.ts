import { z } from "zod";
import { evaluateExpression } from "@/lib/math/safe-expression";

export const transactionTypeValues = ["income", "expense"] as const;
export type TransactionType = (typeof transactionTypeValues)[number];

export const transactionStatusValues = [
  "PENDING",
  "COMPLETED",
  "FAILED",
] as const;

// "FAILED" isn't something the user picks when creating/editing a
// transaction by hand — it's a state a future automated flow (bank
// sync, payment webhook) would set. Keep it in the full enum above
// (used for validation and for displaying existing data, e.g. the
// status badge in columns.tsx) but leave it out of the form's own
// select options.
export const transactionFormStatusValues = transactionStatusValues.filter(
  (status) => status !== "FAILED",
);

// Fixed set, mirrors the `PaymentMethod` Prisma enum. Required on the
// debit form (enforced in refineDebitTransaction below) — but the zod
// field itself still allows "" (`z.enum(["", ...paymentMethodValues])`,
// not this type directly) so the field has a valid value to start from
// before the user picks one.
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

// CREDIT_CARD doesn't belong among the debit form's own choices: this
// field is meant for money that leaves the account the moment the
// transaction happens (cash, debit, Pix, transfer, boleto), and a credit
// purchase doesn't — it goes through creditTransactionSchema below
// instead, which has its own account/card/installment fields and no
// paymentMethod at all (tasks/015.md: the two flows are separate
// schemas/forms, not one schema with a conditional branch). Same
// treatment as "FAILED" in transactionFormStatusValues above: kept in
// the full enum for schema validation and for displaying any legacy row
// that has it, just left out of the picker.
export const paymentMethodFormValues = paymentMethodValues.filter(
  (method) => method !== "CREDIT_CARD",
);

export const recurrenceFrequencyValues = [
  "none",
  "daily",
  "weekly",
  "monthly",
] as const;
export type RecurrenceFrequencyOption =
  (typeof recurrenceFrequencyValues)[number];

export const installmentAmountModeValues = [
  "total",
  "perInstallment",
] as const;
export type InstallmentAmountMode =
  (typeof installmentAmountModeValues)[number];

// Amount is entered as a positive magnitude in the form (comma or period
// for decimals, or a `+ - * /` expression like "120+35" — see
// fields.amount.help); sign is derived from `type` when the value is
// sent to the Server Action. Splits use the same magnitude convention
// (plain numbers only, no expressions), always positive, summing to
// `amount`.
const decimalString = z
  .string()
  .min(1)
  .transform((value) => Number(value.replace(",", ".")))
  .pipe(z.number().positive());

// Tries the safe expression evaluator first (so "120+35" resolves to
// 155), falling back to a plain decimal parse for everything else. Piped
// through the same `z.number().positive()` as `decimalString` so an
// invalid result (non-expression garbage, zero, negative) surfaces
// through the same built-in issue the errorMap already knows how to
// translate — no new message plumbing needed here.
// The one place a typed amount becomes a number: tries the safe
// expression evaluator first (so "120+35" resolves to 155), falling back
// to a plain decimal parse. Exported because the transfer schema has to
// check the same thing conditionally (its amount field is unused when
// the form is moving an account's whole balance), and a second parser
// would be a second set of rules about what counts as a valid amount.
export function parseAmountInput(value: string): number | null {
  const evaluated = evaluateExpression(value);
  const parsed = evaluated ?? Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

const amountString = z
  .string()
  .min(1)
  .transform((value) => parseAmountInput(value) ?? Number.NaN)
  .pipe(z.number().positive());

const splitSchema = z.object({
  personId: z.string().min(1),
  amount: decimalString,
});

// ---------------------------------------------------------------------
// Debit / everyday transactions — cash, Pix, debit card, transfer,
// boleto. No card/installments/invoice, since none of that applies to
// money that leaves the account immediately.
// ---------------------------------------------------------------------

export const debitTransactionSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string(),
  description: z.string().min(1),
  type: z.enum(transactionTypeValues),
  amount: amountString,
  date: z.string().min(1),
  status: z.enum(transactionStatusValues),
  paymentMethod: z.enum(["", ...paymentMethodValues]),
  // Generates a rolling window of occurrences sharing one Recurrence
  // rule row, same as /recurrences' own creation — see
  // RECURRENCE_GENERATION_WINDOW_MONTHS in actions.ts. No count field:
  // unlike installments, a recurrence has no fixed number of repeats to
  // ask for up front.
  recurrence: z.enum(recurrenceFrequencyValues),
  // Who the transaction is attributed to when NOT divided between people
  // — same "no value" convention as categoryId (plain empty string, not
  // `.optional()`), since form state always reads a `string`
  // here, never `string | undefined`. Independent of `splits`: when the
  // "Dividir com outras pessoas" toggle is off, `splits` submits empty
  // and this field alone carries the attribution; the two are reconciled
  // into the final DB-bound splits server-side (see resolveSplitsCreateInput
  // in actions.ts). When dividing is on, this mirrors splits[0].personId
  // (the "Pagou" row) — see the split-math block in
  // debit-transaction-form.tsx.
  personId: z.string().min(1),
  // Only populated while "Dividir com outras pessoas" is active —
  // splits[0] is the "Pagou" row (mirrors `personId` above), splits[1+]
  // are "Deve" rows. Empty otherwise: an empty array is valid and just
  // means "not divided" (see refineDebitTransaction below) — the app
  // treats the transaction as attributed to `personId` alone (or fully
  // unattributed if that's empty too, i.e. "Eu" — see the
  // Transaction.splits doc comment in prisma/schema.prisma).
  splits: z.array(splitSchema),
});

export type DebitTransactionFormValues = z.input<typeof debitTransactionSchema>;
export type DebitTransactionValues = z.output<typeof debitTransactionSchema>;

export const emptyDebitTransactionFormValues: DebitTransactionFormValues = {
  accountId: "",
  categoryId: "",
  description: "",
  type: "expense",
  amount: "",
  date: "",
  status: "COMPLETED",
  paymentMethod: "",
  recurrence: "none",
  personId: "",
  // Empty until "Dividir com outras pessoas" is turned on — the form
  // seeds splits[0] (the "Pagou" row) from `personId` at that point. See
  // the personId/splits comments above.
  splits: [],
};

// Cross-field checks that can't live in the static schema above —
// applied via `superRefine`, called from both the client validator and
// the Server Action so the rules can't drift between the two. Messages
// are passed in already-translated (see AGENTS.md: no hardcoded/default
// UI text) rather than resolved here.
export function refineDebitTransaction(
  data: DebitTransactionValues,
  ctx: z.RefinementCtx,
  options: {
    messages: {
      categoryRequired: string;
      paymentMethodRequired: string;
      splitsMismatch: string;
    };
  },
) {
  // Every transaction has to land in a category — an uncategorized row
  // silently drops out of every category-based report (the home screen's
  // breakdown, budgets, projections), so it's checked here rather than
  // left to the user to notice later. Enforced in the refine, not as
  // `.min(1)` on the schema field, for the same reason paymentMethod is:
  // the message has to arrive already translated (AGENTS.md), and a
  // failing `.min(1)` would short-circuit into Zod's untranslated
  // default instead.
  if (!data.categoryId) {
    ctx.addIssue({
      code: "custom",
      path: ["categoryId"],
      message: options.messages.categoryRequired,
    });
  }

  if (!data.paymentMethod) {
    ctx.addIssue({
      code: "custom",
      path: ["paymentMethod"],
      message: options.messages.paymentMethodRequired,
    });
  }

  // Splits are optional (see the personId/splits comments on the schema
  // above) — an empty array just means "not divided between people," not
  // an error. When present, though, they must add up to the transaction
  // total; that's the one check that still applies.
  if (data.splits.length > 0) {
    const total = data.splits.reduce((sum, split) => sum + split.amount, 0);
    if (Math.abs(total - data.amount) > 0.01) {
      ctx.addIssue({
        code: "custom",
        path: ["splits"],
        message: options.messages.splitsMismatch,
      });
    }
  }
}

// ---------------------------------------------------------------------
// Credit card purchases — always tied to a physical card, with their own
// installment/invoice mechanics. Kept as an entirely separate schema
// (tasks/015.md) rather than a conditional branch of the schema above,
// so neither form has to carry the other's fields/refine rules.
// ---------------------------------------------------------------------

// Everything a credit-card purchase needs — the account picker only ever
// offers CREDIT_CARD accounts (see getTransactionFormOptions/CreditTransactionForm),
// so unlike debitTransactionSchema's own accountId, this one is always
// paired with a required cardId directly in the static schema — no
// runtime account-type check needed. No `paymentMethod` either: it's
// implicitly "credit card".
export const creditTransactionSchema = z.object({
  accountId: z.string().min(1),
  cardId: z.string().min(1),
  categoryId: z.string(),
  description: z.string().min(1),
  type: z.enum(transactionTypeValues),
  amount: amountString,
  date: z.string().min(1),
  status: z.enum(transactionStatusValues),
  installments: z
    .string()
    .transform((value) => (value ? Number(value) : 1))
    .pipe(z.number().int().min(1)),
  installmentAmountMode: z.enum(installmentAmountModeValues),
  // Same rolling-window generation as debitTransactionSchema's own — see
  // its comment above.
  recurrence: z.enum(recurrenceFrequencyValues),
  // Who the purchase is attributed to when NOT divided between people —
  // same personId/splits convention as debitTransactionSchema above.
  personId: z.string().min(1),
  splits: z.array(splitSchema),
});

export type CreditTransactionFormValues = z.input<typeof creditTransactionSchema>;
export type CreditTransactionValues = z.output<typeof creditTransactionSchema>;

export const emptyCreditTransactionFormValues: CreditTransactionFormValues = {
  accountId: "",
  cardId: "",
  categoryId: "",
  description: "",
  type: "expense",
  amount: "",
  date: "",
  status: "COMPLETED",
  installments: "1",
  installmentAmountMode: "total",
  recurrence: "none",
  personId: "",
  splits: [],
};

// Cross-field checks that can't live in the static schema above — called
// from both the client validator and the Server Action with the same
// already-translated messages (AGENTS.md: no hardcoded/default UI text),
// same convention as refineDebitTransaction above.
export function refineCreditTransaction(
  data: CreditTransactionValues,
  ctx: z.RefinementCtx,
  messages: {
    categoryRequired: string;
    splitsMismatch: string;
    recurrenceInstallmentConflict: string;
  },
) {
  // Same rule (and same reasoning) as refineDebitTransaction's own — see
  // its comment.
  if (!data.categoryId) {
    ctx.addIssue({
      code: "custom",
      path: ["categoryId"],
      message: messages.categoryRequired,
    });
  }

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

  // Recurrence (generates one transaction per date) and installments
  // (splits one purchase into N charges) are mutually exclusive.
  if (data.recurrence !== "none" && data.installments > 1) {
    ctx.addIssue({
      code: "custom",
      path: ["recurrence"],
      message: messages.recurrenceInstallmentConflict,
    });
  }
}

// ---------------------------------------------------------------------
// Transferência — two shapes behind one form, picked by `target`:
//
//  - "account": money moving between two of the user's own accounts.
//    Posted as two linked legs sharing a transferGroupId (see
//    createTransfer in actions.ts), and kept OUT of income/expense
//    totals everywhere — moving money between banks isn't earning or
//    spending it.
//  - "person": moves a typed amount from one person's share of one
//    account to a person's share of another (De: pessoa + conta → Para:
//    pessoa + conta). Two linked legs like "account", but each carries a
//    split for its own person — so it moves balances between people on
//    /people (or just between banks, when it's the same person) while
//    still staying out of income/expense totals.
//  - "balance": empties an account into another one. Two legs like
//    "account", except the amount isn't typed — the server reads the
//    account's current balance (or one person's share of it) and moves
//    exactly that, so the source lands on zero. A negative balance moves
//    too: -100 here becomes -100 there, and here becomes 0.
//
// Fields that only apply to one target stay plain strings (not
// `.min(1)`) and are checked in refineTransfer instead, with already-
// translated messages — same reasoning as categoryId/paymentMethod on
// the debit schema above.
// ---------------------------------------------------------------------

export const transferTargetValues = ["account", "person", "balance"] as const;
export type TransferTarget = (typeof transferTargetValues)[number];

export const transferDirectionValues = ["send", "receive"] as const;
export type TransferDirection = (typeof transferDirectionValues)[number];

export const transferSchema = z.object({
  target: z.enum(transferTargetValues),
  // Always one of the user's own accounts: the source for an
  // account-to-account transfer, and the account the money leaves from
  // (send) or lands in (receive) when the other side is a person.
  accountId: z.string().min(1),
  // "account" target only.
  toAccountId: z.string(),
  // "person" target: the source person (paired with accountId). "balance"
  // target: whose share to move ("" = everyone).
  personId: z.string(),
  // "person" target only: the destination person (paired with
  // toAccountId).
  toPersonId: z.string(),
  direction: z.enum(transferDirectionValues),
  categoryId: z.string(),
  // Raw, not `amountString`: the "balance" target has no amount field at
  // all (the server computes it), so the positive-number check is
  // conditional and lives in refineTransfer below.
  amount: z.string(),
  date: z.string().min(1),
  paymentMethod: z.enum(["", ...paymentMethodValues]),
  // Optional — left blank, the server writes "Transferência para/de
  // {nome}" per leg (see createTransfer).
  description: z.string(),
});

export type TransferFormValues = z.input<typeof transferSchema>;
export type TransferValues = z.output<typeof transferSchema>;

export const emptyTransferFormValues: TransferFormValues = {
  target: "account",
  accountId: "",
  toAccountId: "",
  personId: "",
  toPersonId: "",
  direction: "send",
  categoryId: "",
  amount: "",
  date: "",
  // Almost every transfer in Brazil today is a Pix — prefilled so the
  // common case is one field fewer, still changeable.
  paymentMethod: "PIX",
  description: "",
};

export function refineTransfer(
  data: TransferValues,
  ctx: z.RefinementCtx,
  messages: {
    required: string;
    sameAccount: string;
    samePersonAccount: string;
    amountRequired: string;
  },
) {
  if (!data.paymentMethod) {
    ctx.addIssue({
      code: "custom",
      path: ["paymentMethod"],
      message: messages.required,
    });
  }

  // Both account-to-account shapes need a destination that isn't the
  // source; only the typed one needs an amount.
  if (data.target === "account" || data.target === "balance") {
    if (!data.toAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["toAccountId"],
        message: messages.required,
      });
    } else if (data.toAccountId === data.accountId) {
      ctx.addIssue({
        code: "custom",
        path: ["toAccountId"],
        message: messages.sameAccount,
      });
    }
    // The amount comes from the account's own balance — nothing typed to
    // validate, and the server refuses a balance of zero (there would be
    // nothing to move). An empty personId means "todas as pessoas".
    if (data.target === "balance") return;
    if ((parseAmountInput(data.amount) ?? 0) <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: messages.amountRequired,
      });
    }
    return;
  }

  if ((parseAmountInput(data.amount) ?? 0) <= 0) {
    ctx.addIssue({
      code: "custom",
      path: ["amount"],
      message: messages.amountRequired,
    });
  }

  // "person": both ends are a person + an account. Either may repeat
  // (same person between banks, or two people on the same bank), just
  // not both at once — that would move nothing.
  for (const path of ["personId", "toPersonId", "toAccountId"] as const) {
    if (!data[path]) {
      ctx.addIssue({ code: "custom", path: [path], message: messages.required });
    }
  }
  if (
    data.toAccountId &&
    data.toPersonId &&
    data.toAccountId === data.accountId &&
    data.toPersonId === data.personId
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["toPersonId"],
      message: messages.samePersonAccount,
    });
  }
}

// One row of the debit "modo em lote" table (tasks/006-transacoes-
// recursos-avancados.md) — a plain debit transaction, no card/
// installments/recurrence. Each row picks its own type, unlike the
// single-transaction form. `personId`/`paymentMethod` deliberately stay
// plain (unrefined) strings here instead of `.min(1)`/non-empty-enum —
// they're enforced in `createTransactionsBatch` instead, with a
// translated per-row message, since this schema is `safeParse`d there
// without a custom error map (unlike the two single-form schemas above,
// which always go through `makeErrorMap` client-side). Adding `.min(1)`
// here would short-circuit parsing and surface Zod's untranslated
// default message instead. `splits` follows the exact same personId/
// splits convention as debitTransactionSchema above (empty = not
// divided, personId alone carries the attribution) — its own sum-matches-
// amount check lives in BatchTransactionTable (client, before a row can
// join the queue) and createTransactionsBatch (server), same
// unrefined-here-checked-there reasoning as personId/paymentMethod.
export const batchRowSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string(),
  personId: z.string(),
  paymentMethod: z.enum(["", ...paymentMethodValues]),
  description: z.string().min(1),
  type: z.enum(transactionTypeValues),
  date: z.string().min(1),
  amount: amountString,
  splits: z.array(splitSchema),
});

export type BatchRowFormValues = z.input<typeof batchRowSchema>;
export type BatchRowValues = z.output<typeof batchRowSchema>;

export const emptyBatchRow: BatchRowFormValues = {
  accountId: "",
  paymentMethod: "",
  categoryId: "",
  personId: "",
  description: "",
  type: "expense",
  date: "",
  amount: "",
  splits: [],
};

// Credit-card counterpart of batchRowSchema above — a row is always a
// one-off purchase (no recurrence, same reasoning as the debit batch),
// but unlike the debit row it DOES carry installments, since splitting a
// purchase into N charges is core to how a card is used day-to-day.
// `installmentAmountMode` mirrors creditTransactionSchema's own: "total"
// splits the typed amount evenly across installments, "perInstallment"
// uses it as-is per installment. `personId` stays a plain string for the
// same reason `batchRowSchema`'s own does — enforced with a translated
// message in `createCreditTransactionsBatch` instead of `.min(1)` here.
export const creditBatchRowSchema = z.object({
  accountId: z.string().min(1),
  cardId: z.string().min(1),
  categoryId: z.string(),
  personId: z.string(),
  description: z.string().min(1),
  type: z.enum(transactionTypeValues),
  date: z.string().min(1),
  amount: amountString,
  installments: z
    .string()
    .transform((value) => (value ? Number(value) : 1))
    .pipe(z.number().int().min(1)),
  installmentAmountMode: z.enum(installmentAmountModeValues),
  // Same choice creditTransactionSchema's own create path offers via a
  // separate `options` param (PastInstallmentsDialog) — a batch row has
  // no separate options slot, since createCreditTransactionsBatch takes
  // one plain array, so it rides along as a field on the row itself
  // instead. Ignored unless installments > 1 and the first installment's
  // due date is already in the past.
  skipPastInstallments: z.boolean(),
});

export type CreditBatchRowFormValues = z.input<typeof creditBatchRowSchema>;
export type CreditBatchRowValues = z.output<typeof creditBatchRowSchema>;

export const emptyCreditBatchRow: CreditBatchRowFormValues = {
  accountId: "",
  cardId: "",
  categoryId: "",
  personId: "",
  description: "",
  type: "expense",
  date: "",
  amount: "",
  installments: "1",
  installmentAmountMode: "total",
  skipPastInstallments: false,
};
