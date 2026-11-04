import { z } from "zod";
import { MONTH_PATTERN } from "@/lib/open-finance/months";

export const calendarDateSchema = z.iso.date();
const identifier = z.string().trim().min(1).max(200);
const money = z.number().finite().min(-9999999999.99).max(9999999999.99)
  .refine((value) => Number(value.toFixed(2)) === value);

export const pluggyAccountSchema = z.object({
  id: z.uuid(), itemId: z.uuid(), name: z.string().min(1).max(500),
  type: z.enum(["BANK", "CREDIT"]), currencyCode: z.string().length(3),
});
export const pluggyItemSchema = z.object({
  id: z.uuid(), status: z.string(), consentExpiresAt: z.iso.datetime({ offset: true }).nullish(),
  clientUserId: z.string().nullish(),
  connector: z.object({ id: z.number().int(), name: z.string(), isSandbox: z.boolean().optional() }).optional(),
});
export const widgetSuccessSchema = z.object({ item: z.object({ id: z.uuid() }) });
export const widgetRegistrationSchema = z.object({ itemId: z.uuid() });
export const pluggyWebhookSchema = z.object({ event: z.string().max(100), itemId: z.uuid().optional() });
export const pluggyTransactionSchema = z.object({
  id: z.uuid(), accountId: z.uuid(), providerId: z.string().max(1000).nullish(),
  description: z.string().max(2000), amount: money,
  amountInAccountCurrency: money.nullish(), currencyCode: z.string().length(3),
  // Pluggy encodes calendar dates as UTC-midnight timestamps. Read the
  // date digits directly, then parseCalendarDate at the storage boundary.
  date: z.union([calendarDateSchema, z.iso.datetime({ offset: true })]),
  status: z.enum(["PENDING", "POSTED"]),
  operationType: z.string().nullish(),
  creditCardMetadata: z.object({
    installmentNumber: z.number().int().positive().nullish(),
    totalInstallments: z.number().int().positive().nullish(),
  }).nullish(),
});

export const connectionSchema = z.object({ label: z.string().trim().min(1).max(80), itemId: z.string().min(1).pipe(z.uuid()) });
export const sourceIdSchema = identifier;
export const mappingSchema = z.object({
  sourceId: identifier, accountId: identifier, cardId: z.string().max(200), fromDate: calendarDateSchema,
});
export const previewSchema = z.object({ sourceId: identifier, month: z.string().regex(MONTH_PATTERN), cursor: z.string().max(8000).nullable() });
export const reviewRequestSchema = z.object({ sourceId: identifier, transactionId: z.uuid() });
export const reviewPaymentMethodValues = [
  "CASH",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "PIX",
  "BOLETO",
  "OTHER",
] as const;
export type ReviewPaymentMethod = (typeof reviewPaymentMethodValues)[number];
export const reviewDebitPaymentMethodValues = reviewPaymentMethodValues.filter(
  (method) => method !== "CREDIT_CARD",
);

const positiveMoneyString = z.string().regex(/^(?=.*[1-9])\d{1,10}(?:[.,]\d{1,2})?$/);
export const reviewSplitSchema = z.object({
  personId: identifier,
  amount: positiveMoneyString,
});
export const reviewEditsSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  date: calendarDateSchema,
  // Positive magnitude; the explicit type supplies the sign through Dinero.
  amount: positiveMoneyString,
  type: z.enum(["income", "expense"]),
  categoryId: z.string().max(200),
  paymentMethod: z.enum(["", ...reviewPaymentMethodValues]).default(""),
  personId: z.string().max(200).default(""),
  splits: z.array(reviewSplitSchema).max(50).default([]),
});
const processBaseSchema = reviewRequestSchema.extend({
  expectedDestination: mappingSchema.omit({ sourceId: true }),
  existingTransactionId: z.string().max(200),
  closingDate: z.union([calendarDateSchema, z.literal("")]),
  dueDate: z.union([calendarDateSchema, z.literal("")]),
  expectedAmount: z.string().regex(/^-?\d{1,10}\.\d{2}$/),
  expectedDate: calendarDateSchema,
  expectedDescription: z.string().max(2000),
  allowDuplicate: z.boolean().optional(),
});
export const processSchema = z.discriminatedUnion("mode", [
  processBaseSchema.extend({ mode: z.literal("create"), edits: reviewEditsSchema }),
  processBaseSchema.extend({ mode: z.enum(["match", "ignore"]) }),
]);
export type PluggyAccount = z.infer<typeof pluggyAccountSchema>;
export type PluggyTransaction = z.infer<typeof pluggyTransactionSchema>;
export type MappingValues = z.infer<typeof mappingSchema>;
export type ProcessValues = z.infer<typeof processSchema>;
export type ReviewEdits = z.infer<typeof reviewEditsSchema>;

export class OpenFinanceError extends Error {
  constructor(public readonly code: "invalid" | "configuration" | "provider" | "access" | "mapping" | "mappingChanged" | "duplicate" | "pending" | "payment" | "currency" | "invoice" | "busy" | "stale" | "widget") {
    super(code);
  }
}
