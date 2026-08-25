import { z } from "zod";

export const accountTypeValues = ["CHECKING", "SAVINGS", "CASH"] as const;
export type AccountTypeOption = (typeof accountTypeValues)[number];

// Credit Card (tasks/008) and Investment/Pocket (tasks/009) accounts get
// their own dedicated screens later — this route only ever creates/edits
// the three plain account types above, even though `AccountType` (Prisma)
// has more values. `listAccounts` in actions.ts enforces the same
// restriction when reading data back, so the two can't drift.
//
// The form only asks for name + type — no institution/bank field, and no
// Account.bankId column exists in the schema either (see
// prisma/schema.prisma's top comment).
export const accountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(accountTypeValues),
});

export type AccountFormValues = z.input<typeof accountSchema>;
export type AccountValues = z.output<typeof accountSchema>;

export const emptyAccountFormValues: AccountFormValues = {
  name: "",
  type: "CHECKING",
};
