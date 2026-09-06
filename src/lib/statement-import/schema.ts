import { z } from "zod";

// Where the imported entries are headed — chosen BEFORE the file is
// attached (see ImportStatementScreen), not detected from the document.
// A fatura goes to a credit-card account and produces credit batch rows
// (card + parcelas); an extrato goes to a checking/savings/cash account
// and produces debit batch rows (payment method, no card). Keeping the
// destination a user choice is what makes every parsed row land on a
// real account even when the document's own layout is one this app has
// never seen.
export const statementSourceKindValues = ["credit", "debit"] as const;
export type StatementSourceKind = (typeof statementSourceKindValues)[number];

// Deliberately larger than the 1 MB Next.js allows a Server Action body
// by default — a phone photo of a statement is routinely 3–5 MB, so
// next.config.ts raises `serverActions.bodySizeLimit` to match this.
// Enforced on the client (before uploading a file that would be
// rejected) and again in the Server Action.
export const MAX_IMPORT_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_IMPORT_FILE_MB = Math.round(
  MAX_IMPORT_FILE_BYTES / (1024 * 1024),
);

// PDF is read as text (unpdf); the image types are the ones Groq's
// vision models accept. HEIC is left out on purpose: iPhones convert to
// JPEG when a photo goes through a file input, and a raw .heic would
// reach the model as something it cannot decode.
export const IMPORT_IMAGE_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const IMPORT_PDF_MEDIA_TYPE = "application/pdf";
export const ACCEPTED_IMPORT_MEDIA_TYPES = [
  IMPORT_PDF_MEDIA_TYPE,
  ...IMPORT_IMAGE_MEDIA_TYPES,
] as const;

// The `accept` attribute for the file input. `image/*` (rather than the
// three types above) so a phone's camera/gallery picker isn't narrowed
// to a subset it may not label correctly — anything that isn't one of
// the accepted types is caught by the size/type check before upload.
export const IMPORT_FILE_ACCEPT = "application/pdf,image/*";

// One line of the document as the model reports it. Amounts always come
// back as a positive magnitude with the direction in `kind`, mirroring
// this app's own form convention (magnitude + type, sign derived
// server-side) rather than a signed number the model would have to get
// right per bank layout.
export const statementEntrySchema = z.object({
  description: z.string(),
  // YYYY-MM-DD. Statements routinely print only day/month, so the prompt
  // hands the model today's date to resolve the year against.
  date: z.string(),
  amount: z.number(),
  kind: z.enum(["expense", "income"]),
  // "PARC 03/10" and friends. Both null when the line isn't part of an
  // installment plan — see statementEntriesToCreditRows for how the pair
  // is turned back into an original purchase date + installment count.
  installmentNumber: z.number().nullable(),
  installmentTotal: z.number().nullable(),
  // Only meaningful for a bank statement (a fatura's lines are all
  // "credit card" by definition). Null whenever the line doesn't say.
  paymentMethod: z
    .enum(["CASH", "DEBIT_CARD", "BANK_TRANSFER", "PIX", "BOLETO", "OTHER"])
    .nullable(),
});

export type StatementEntry = z.infer<typeof statementEntrySchema>;

export const statementExtractionSchema = z.object({
  entries: z.array(statementEntrySchema),
});
