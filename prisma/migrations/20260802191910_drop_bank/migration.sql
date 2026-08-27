/*
  Warnings:

  - You are about to drop the column `bankId` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the `Bank` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_bankId_fkey";

-- DropForeignKey
ALTER TABLE "Bank" DROP CONSTRAINT "Bank_userId_fkey";

-- DropIndex
DROP INDEX "Account_bankId_idx";

-- AlterTable
ALTER TABLE "Account" DROP COLUMN "bankId";

-- DropTable
DROP TABLE "Bank";
