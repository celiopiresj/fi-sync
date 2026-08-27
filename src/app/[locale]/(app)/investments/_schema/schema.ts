import { z } from "zod";

// Investment (Tesouro Direto, ações...) and Pocket/"caixinha" (reserva de
// emergência...) accounts share the same Account model as checking/
// savings/cash (accounts/_schema/schema.ts) — this route only ever
// creates/edits these two types, mirroring how accounts/ restricts
// itself to CHECKING/SAVINGS/CASH. listInvestmentAccounts in actions.ts
// enforces the same restriction reading data back, so the two can't
// drift.
export const investmentAccountTypeValues = ["INVESTMENT", "POCKET"] as const;
export type InvestmentAccountTypeOption =
  (typeof investmentAccountTypeValues)[number];

export const investmentAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(investmentAccountTypeValues),
});

export type InvestmentAccountFormValues = z.input<typeof investmentAccountSchema>;
export type InvestmentAccountValues = z.output<typeof investmentAccountSchema>;

export const emptyInvestmentAccountFormValues: InvestmentAccountFormValues = {
  name: "",
  type: "INVESTMENT",
};

// Same positive-decimal grammar as transactions'/accounts' own
// decimalString (per-route duplication, AGENTS.md convention).
const decimalString = z
  .string()
  .min(1)
  .transform((value) => Number(value.replace(",", ".")))
  .pipe(z.number().positive());

// A manual movement against one investment/pocket account — aporte
// (contribution) posts a positive Transaction, resgate (withdrawal) a
// negative one; see createInvestmentMovement in actions.ts. `kind` only
// ever decides the sign and the default description — it isn't
// persisted as its own field (the user asked for manual entry
// specifically to avoid modeling variable interest rates, see
// tasks/009.md), so there's no separate "yield vs contribution" column
// to store it in.
//
// `amount` means something different for YIELD than for the other two:
// for CONTRIBUTION/WITHDRAWAL it's the magnitude the user is moving
// (always positive, sign applied server-side by `kind`); for YIELD it's
// the account's current total value straight off the user's statement —
// easier to know than the exact yield amount, especially with several
// small credits — and createInvestmentMovement posts the *difference*
// between that and what the account already sums to as the actual
// transaction. Still always a positive number either way (a current
// balance and a contribution/withdrawal magnitude are both naturally
// positive), so `decimalString` covers both without a conditional shape.
export const investmentMovementKindValues = [
  "CONTRIBUTION",
  "YIELD",
  "WITHDRAWAL",
] as const;
export type InvestmentMovementKind = (typeof investmentMovementKindValues)[number];

export const investmentMovementSchema = z.object({
  kind: z.enum(investmentMovementKindValues),
  amount: decimalString,
  date: z.string().min(1),
  // Optional — actions.ts falls back to a translated default per `kind`
  // when left blank, same "not hardcoded, just deferred to the server's
  // own translations" spirit as the rest of the app's forms.
  description: z.string(),
});

export type InvestmentMovementFormValues = z.input<typeof investmentMovementSchema>;
export type InvestmentMovementValues = z.output<typeof investmentMovementSchema>;

export const emptyInvestmentMovementFormValues: InvestmentMovementFormValues = {
  kind: "CONTRIBUTION",
  amount: "",
  date: "",
  description: "",
};
