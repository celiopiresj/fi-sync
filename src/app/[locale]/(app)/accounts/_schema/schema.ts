import { z } from "zod";

export const accountTypeValues = ["CHECKING", "SAVINGS", "CASH"] as const;
export type AccountTypeOption = (typeof accountTypeValues)[number];

// Optional — left blank (empty string) means "no opening transaction".
// `balance` isn't a stored column (see accounts/actions.ts), so a
// non-empty value here becomes a plain Transaction dated today at
// creation time, same "balance is just the sum of transactions" rule
// investments/actions.ts's createInvestmentMovement follows for its own
// CONTRIBUTION/WITHDRAWAL/YIELD entries.
const optionalDecimalString = z
  .string()
  .transform((value) => (value.trim() === "" ? null : Number(value.replace(",", "."))))
  .pipe(z.number().positive().nullable());

// Credit Card (tasks/008) and Investment/Pocket (tasks/009) accounts get
// their own dedicated screens later — this route only ever creates/edits
// the three plain account types above, even though `AccountType` (Prisma)
// has more values. `listAccounts` in actions.ts enforces the same
// restriction when reading data back, so the two can't drift.
//
// The form only asks for name + type (+ an optional initial balance for
// CHECKING accounts, see account-form.tsx) — no institution/bank field,
// and no Account.bankId column exists in the schema either (see
// prisma/schema.prisma's top comment).
export const accountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(accountTypeValues),
  initialBalance: optionalDecimalString,
});

export type AccountFormValues = z.input<typeof accountSchema>;
export type AccountValues = z.output<typeof accountSchema>;

export const emptyAccountFormValues: AccountFormValues = {
  name: "",
  type: "CHECKING",
  initialBalance: "",
};
