-- AlterTable
ALTER TABLE "Recurrence" ADD COLUMN     "cardId" TEXT;

-- CreateTable
CREATE TABLE "RecurrenceSplit" (
    "id" TEXT NOT NULL,
    "recurrenceId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "RecurrenceSplit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurrenceSplit_recurrenceId_idx" ON "RecurrenceSplit"("recurrenceId");

-- CreateIndex
CREATE INDEX "RecurrenceSplit_personId_idx" ON "RecurrenceSplit"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurrenceSplit_recurrenceId_personId_key" ON "RecurrenceSplit"("recurrenceId", "personId");

-- CreateIndex
CREATE INDEX "Recurrence_cardId_idx" ON "Recurrence"("cardId");

-- AddForeignKey
ALTER TABLE "Recurrence" ADD CONSTRAINT "Recurrence_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurrenceSplit" ADD CONSTRAINT "RecurrenceSplit_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "Recurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurrenceSplit" ADD CONSTRAINT "RecurrenceSplit_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
