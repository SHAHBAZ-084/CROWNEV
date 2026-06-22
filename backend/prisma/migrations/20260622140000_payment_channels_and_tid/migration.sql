-- CreateEnum
CREATE TYPE "PaymentChannelType" AS ENUM ('BANK', 'WALLET');

-- CreateTable
CREATE TABLE "BranchPaymentChannel" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "type" "PaymentChannelType" NOT NULL,
    "name" TEXT NOT NULL,
    "accountTitle" TEXT,
    "accountNumber" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchPaymentChannel_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paymentTransactionId" TEXT;

-- CreateIndex
CREATE INDEX "BranchPaymentChannel_branchId_idx" ON "BranchPaymentChannel"("branchId");

-- AddForeignKey
ALTER TABLE "BranchPaymentChannel" ADD CONSTRAINT "BranchPaymentChannel_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
