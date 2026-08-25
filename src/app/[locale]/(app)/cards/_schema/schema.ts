import { z } from "zod";

// Same positive-decimal grammar as transactions' own decimalString
// (comma or period, no expressions) — duplicated per the _schema/
// actions-per-route convention (AGENTS.md), not imported cross-route.
const decimalString = z
  .string()
  .min(1)
  .transform((value) => Number(value.replace(",", ".")))
  .pipe(z.number().positive());

// 1–31 day-of-month, same shape for closing and due day. No dedicated
// numeric-field primitive in the project (see transactions'
// `installments` field) — plain TextField, parsed here.
const dayOfMonthString = z
  .string()
  .min(1)
  .transform((value) => Number(value))
  .pipe(z.number().int().min(1).max(31));

// One physical card row in the dynamic array below. `id` is "" for a
// card the user just added in this form session (not yet in the DB) —
// updateCreditCardAccount (actions.ts) uses that to tell "update this
// existing Card" apart from "create a new one", and to know which rows
// were removed. `lastFourDigits` is validated in
// refineCreditCardAccount below (not `.regex()` here) so the message
// comes through next-intl instead of a hardcoded string baked into the
// schema (AGENTS.md: no hardcoded UI text).
const cardRowSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  lastFourDigits: z.string(),
  colorStyle: z.string().optional(),
});

export const creditCardAccountSchema = z.object({
  name: z.string().min(1),
  limit: decimalString,
  closingDay: dayOfMonthString,
  dueDay: dayOfMonthString,
  // At least one physical card — a credit card account with zero cards
  // has nothing to select in transaction-form.tsx's card picker.
  cards: z.array(cardRowSchema).min(1),
});

export type CreditCardAccountFormValues = z.input<typeof creditCardAccountSchema>;
export type CreditCardAccountValues = z.output<typeof creditCardAccountSchema>;

export const emptyCardRow = { id: "", name: "", lastFourDigits: "", colorStyle: undefined };

export const emptyCreditCardAccountFormValues: CreditCardAccountFormValues = {
  name: "",
  limit: "",
  closingDay: "",
  dueDay: "",
  cards: [emptyCardRow],
};

// Cross-field check that can't live in the static schema above — each
// card's lastFourDigits, when filled in, must be exactly 4 digits.
// Called from both the client validator and the Server Action with the
// same already-translated message, same convention as
// transactions/_schema/schema.ts's refineTransaction.
export function refineCreditCardAccount(
  data: CreditCardAccountValues,
  ctx: z.RefinementCtx,
  messages: { lastFourDigitsInvalid: string },
) {
  data.cards.forEach((card, index) => {
    if (card.lastFourDigits && !/^\d{4}$/.test(card.lastFourDigits)) {
      ctx.addIssue({
        code: "custom",
        path: ["cards", index, "lastFourDigits"],
        message: messages.lastFourDigitsInvalid,
      });
    }
  });
}
