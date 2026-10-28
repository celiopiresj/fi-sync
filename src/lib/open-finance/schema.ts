import { z } from "zod";

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
});
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

export const connectionSchema = z.object({ label: z.string().trim().min(1).max(80), itemId: z.uuid() });
export const sourceIdSchema = identifier;
export const mappingSchema = z.object({
  sourceId: identifier, accountId: identifier, cardId: z.string().max(200), fromDate: calendarDateSchema,
});
export const previewSchema = z.object({ sourceId: identifier, cursor: z.string().max(8000).nullable() });
export const processSchema = z.object({
  sourceId: identifier, transactionId: z.uuid(), mode: z.enum(["create", "match", "ignore"]),
  existingTransactionId: z.string().max(200),
  closingDate: z.union([calendarDateSchema, z.literal("")]),
  dueDate: z.union([calendarDateSchema, z.literal("")]),
  expectedAmount: z.string().regex(/^-?\d{1,10}\.\d{2}$/),
  expectedDate: calendarDateSchema,
  expectedDescription: z.string().max(2000),
});
export type PluggyAccount = z.infer<typeof pluggyAccountSchema>;
export type PluggyTransaction = z.infer<typeof pluggyTransactionSchema>;
export type MappingValues = z.infer<typeof mappingSchema>;
export type ProcessValues = z.infer<typeof processSchema>;

export class OpenFinanceError extends Error {
  constructor(public readonly code: "invalid" | "configuration" | "provider" | "access" | "mapping" | "duplicate" | "pending" | "payment" | "currency" | "invoice" | "busy" | "stale") {
    super(code);
  }
}
