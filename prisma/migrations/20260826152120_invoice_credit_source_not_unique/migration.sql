-- InvoiceCredit.sourcePaymentId is not @unique: a single overpayment can
-- fund credit toward more than one downstream invoice (see the field's
-- own comment in schema.prisma).
-- DropIndex
DROP INDEX "InvoiceCredit_sourcePaymentId_key";

-- CreateIndex
CREATE INDEX "InvoiceCredit_sourcePaymentId_idx" ON "InvoiceCredit"("sourcePaymentId");
