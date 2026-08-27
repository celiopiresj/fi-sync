-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'PARTIALLY_PAID';

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceCredit" (
    "id" TEXT NOT NULL,
    "sourcePaymentId" TEXT NOT NULL,
    "targetInvoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoicePayment_transactionId_key" ON "InvoicePayment"("transactionId");

-- CreateIndex
CREATE INDEX "InvoicePayment_invoiceId_idx" ON "InvoicePayment"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceCredit_sourcePaymentId_key" ON "InvoiceCredit"("sourcePaymentId");

-- CreateIndex
CREATE INDEX "InvoiceCredit_targetInvoiceId_idx" ON "InvoiceCredit"("targetInvoiceId");

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCredit" ADD CONSTRAINT "InvoiceCredit_sourcePaymentId_fkey" FOREIGN KEY ("sourcePaymentId") REFERENCES "InvoicePayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCredit" ADD CONSTRAINT "InvoiceCredit_targetInvoiceId_fkey" FOREIGN KEY ("targetInvoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One-time backfill: the old model allowed at most one settlement
-- Transaction per Invoice (paymentTransactionId, dropped below) — carry
-- any existing one over into the new InvoicePayment table before that
-- column disappears, so pre-existing paid invoices keep their payment
-- history and still revert correctly if that transaction is later deleted.
INSERT INTO "InvoicePayment" ("id", "invoiceId", "transactionId", "amount", "paidAt", "createdAt")
SELECT gen_random_uuid()::text, "id", "paymentTransactionId", COALESCE("paidAmount", 0), COALESCE("paidAt", "updatedAt"), CURRENT_TIMESTAMP
FROM "Invoice"
WHERE "paymentTransactionId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_paymentTransactionId_fkey";

-- DropIndex
DROP INDEX "Invoice_paymentTransactionId_key";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "paymentTransactionId";
