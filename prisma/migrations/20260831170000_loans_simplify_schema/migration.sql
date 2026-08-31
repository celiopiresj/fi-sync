-- AlterTable
ALTER TABLE "Loan" DROP COLUMN "direction",
DROP COLUMN "dueDay",
DROP COLUMN "startDate",
DROP COLUMN "totalAmount",
ADD COLUMN     "dueDate" DATE NOT NULL;

-- DropEnum
DROP TYPE "LoanDirection";
