-- AlterTable
ALTER TABLE "User" ADD COLUMN     "telegramDraft" JSONB,
ADD COLUMN     "telegramDraftAt" TIMESTAMPTZ(3);
