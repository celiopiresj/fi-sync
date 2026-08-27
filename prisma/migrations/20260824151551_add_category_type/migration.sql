-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('EXPENSE', 'INCOME', 'INVESTMENT');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "colorStyle" TEXT,
ADD COLUMN     "type" "CategoryType" NOT NULL DEFAULT 'EXPENSE';
