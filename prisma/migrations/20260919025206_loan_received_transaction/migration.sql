-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "loanId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_loanId_key" ON "Transaction"("loanId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

