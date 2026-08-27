-- CreateEnum
CREATE TYPE "InvestmentMovementKind" AS ENUM ('CONTRIBUTION', 'YIELD', 'WITHDRAWAL');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "investmentMovementKind" "InvestmentMovementKind";
