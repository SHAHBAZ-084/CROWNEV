-- CreateEnum
CREATE TYPE "ChassisStatus" AS ENUM ('IN_STOCK', 'SOLD');

-- CreateTable
CREATE TABLE "BikeChassisNumber" (
    "id" SERIAL NOT NULL,
    "chassisNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "status" "ChassisStatus" NOT NULL DEFAULT 'IN_STOCK',
    "purchaseId" INTEGER NOT NULL,
    "saleOrderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BikeChassisNumber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BikeChassisNumber_chassisNumber_key" ON "BikeChassisNumber"("chassisNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BikeChassisNumber_saleOrderId_key" ON "BikeChassisNumber"("saleOrderId");

-- CreateIndex
CREATE INDEX "BikeChassisNumber_productId_branchId_status_idx" ON "BikeChassisNumber"("productId", "branchId", "status");

-- CreateIndex
CREATE INDEX "BikeChassisNumber_branchId_idx" ON "BikeChassisNumber"("branchId");

-- CreateIndex
CREATE INDEX "BikeChassisNumber_purchaseId_idx" ON "BikeChassisNumber"("purchaseId");

-- AddForeignKey
ALTER TABLE "BikeChassisNumber" ADD CONSTRAINT "BikeChassisNumber_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BikeChassisNumber" ADD CONSTRAINT "BikeChassisNumber_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BikeChassisNumber" ADD CONSTRAINT "BikeChassisNumber_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BikeChassisNumber" ADD CONSTRAINT "BikeChassisNumber_saleOrderId_fkey" FOREIGN KEY ("saleOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
