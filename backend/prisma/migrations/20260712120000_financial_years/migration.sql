-- CreateEnum
CREATE TYPE "FinancialYearStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "FinancialYear" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "FinancialYearStatus" NOT NULL DEFAULT 'ACTIVE',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,

    CONSTRAINT "FinancialYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialYearClosingBalance" (
    "id" SERIAL NOT NULL,
    "financialYearId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "FinancialYearClosingBalance_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "financialYearId" INTEGER;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "financialYearId" INTEGER;

-- AlterTable
ALTER TABLE "ServiceInvoice" ADD COLUMN "financialYearId" INTEGER;

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN "financialYearId" INTEGER;

-- DropIndex
DROP INDEX IF EXISTS "Voucher_branchId_type_number_key";

-- CreateIndex
CREATE INDEX "Order_branchId_financialYearId_idx" ON "Order"("branchId", "financialYearId");

-- CreateIndex
CREATE INDEX "Purchase_branchId_financialYearId_idx" ON "Purchase"("branchId", "financialYearId");

-- CreateIndex
CREATE INDEX "ServiceInvoice_branchId_financialYearId_idx" ON "ServiceInvoice"("branchId", "financialYearId");

-- CreateIndex
CREATE INDEX "Voucher_branchId_financialYearId_type_idx" ON "Voucher"("branchId", "financialYearId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_branchId_financialYearId_type_number_key" ON "Voucher"("branchId", "financialYearId", "type", "number");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialYear_branchId_label_key" ON "FinancialYear"("branchId", "label");

-- CreateIndex
CREATE INDEX "FinancialYear_branchId_status_idx" ON "FinancialYear"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialYearClosingBalance_financialYearId_accountId_key" ON "FinancialYearClosingBalance"("financialYearId", "accountId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceInvoice" ADD CONSTRAINT "ServiceInvoice_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialYear" ADD CONSTRAINT "FinancialYear_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialYear" ADD CONSTRAINT "FinancialYear_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialYearClosingBalance" ADD CONSTRAINT "FinancialYearClosingBalance_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialYearClosingBalance" ADD CONSTRAINT "FinancialYearClosingBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
