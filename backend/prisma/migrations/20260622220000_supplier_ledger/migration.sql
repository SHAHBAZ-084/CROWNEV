-- CreateEnum
CREATE TYPE "SupplierLedgerType" AS ENUM ('DEBIT', 'CREDIT');

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "balance" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SupplierLedger" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "purchaseId" INTEGER,
    "type" "SupplierLedgerType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierLedger_supplierId_idx" ON "SupplierLedger"("supplierId");
CREATE INDEX "SupplierLedger_createdAt_idx" ON "SupplierLedger"("createdAt");

-- AddForeignKey
ALTER TABLE "SupplierLedger" ADD CONSTRAINT "SupplierLedger_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierLedger" ADD CONSTRAINT "SupplierLedger_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
