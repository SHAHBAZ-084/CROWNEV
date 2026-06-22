-- AlterTable
ALTER TABLE "Order" ADD COLUMN "cargoTrackingId" TEXT;
ALTER TABLE "Order" ADD COLUMN "customerName" TEXT;
ALTER TABLE "Order" ADD COLUMN "customerPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN "customerAddress" TEXT;
ALTER TABLE "Order" ADD COLUMN "invoiceGeneratedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "chassisNumber" TEXT;
