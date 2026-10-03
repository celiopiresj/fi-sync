import { z } from "zod";

// "all": everything already bought on an unpaid invoice plus every
// installment still to come. "installments": only the installments.
// Future recurring charges never count under either — see
// computeCardPayoff's own comment on why.
export const payoffScopeValues = ["all", "installments"] as const;
export type PayoffScope = (typeof payoffScopeValues)[number];

// Filters getCardPayoff accepts from the client — validated before any
// of it reaches Prisma (AGENTS.md). `fromMonth` is a "yyyy-MM" invoice
// due month: invoices due before it are left out (they get paid as
// usual), everything from it onward is what "quitar" would cost.
export const cardPayoffFiltersSchema = z.object({
  accountId: z.string().min(1).optional(),
  // Empty/omitted = everyone. Several people sum their shares.
  personIds: z.array(z.string().min(1)).max(500).optional(),
  fromMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  scope: z.enum(payoffScopeValues).optional(),
});

export type CardPayoffFilters = z.input<typeof cardPayoffFiltersSchema>;
