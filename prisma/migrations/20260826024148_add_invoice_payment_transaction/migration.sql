-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "paymentTransactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_paymentTransactionId_key" ON "Invoice"("paymentTransactionId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
