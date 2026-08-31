-- CreateEnum
CREATE TYPE "LoanDirection" AS ENUM ('LENT', 'BORROWED');

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "direction" "LoanDirection" NOT NULL,
    "description" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanInstallment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "transactionId" TEXT,

    CONSTRAINT "LoanInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Loan_userId_idx" ON "Loan"("userId");

-- CreateIndex
CREATE INDEX "Loan_personId_idx" ON "Loan"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanInstallment_transactionId_key" ON "LoanInstallment"("transactionId");

-- CreateIndex
CREATE INDEX "LoanInstallment_loanId_idx" ON "LoanInstallment"("loanId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanInstallment_loanId_installmentNumber_key" ON "LoanInstallment"("loanId", "installmentNumber");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
