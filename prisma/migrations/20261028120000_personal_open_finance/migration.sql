-- CreateTable
CREATE TABLE "OpenFinanceConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenFinanceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenFinanceSource" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "accountId" TEXT,
    "cardId" TEXT,
    "importFromDate" DATE,

    CONSTRAINT "OpenFinanceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenFinanceImport" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenFinanceImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpenFinanceConnection_itemId_key" ON "OpenFinanceConnection"("itemId");

-- CreateIndex
CREATE INDEX "OpenFinanceConnection_userId_idx" ON "OpenFinanceConnection"("userId");

-- CreateIndex
CREATE INDEX "OpenFinanceSource_accountId_idx" ON "OpenFinanceSource"("accountId");

-- CreateIndex
CREATE INDEX "OpenFinanceSource_cardId_idx" ON "OpenFinanceSource"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "OpenFinanceSource_connectionId_externalAccountId_key" ON "OpenFinanceSource"("connectionId", "externalAccountId");

-- CreateIndex
CREATE INDEX "OpenFinanceImport_transactionId_idx" ON "OpenFinanceImport"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "OpenFinanceImport_sourceId_externalKey_key" ON "OpenFinanceImport"("sourceId", "externalKey");

-- AddForeignKey
ALTER TABLE "OpenFinanceConnection" ADD CONSTRAINT "OpenFinanceConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenFinanceSource" ADD CONSTRAINT "OpenFinanceSource_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "OpenFinanceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenFinanceSource" ADD CONSTRAINT "OpenFinanceSource_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenFinanceSource" ADD CONSTRAINT "OpenFinanceSource_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenFinanceImport" ADD CONSTRAINT "OpenFinanceImport_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "OpenFinanceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenFinanceImport" ADD CONSTRAINT "OpenFinanceImport_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
