-- AlterTable
ALTER TABLE "CustomerLedger" ADD COLUMN "serviceInvoiceId" INTEGER;

-- CreateTable
CREATE TABLE "ServiceInvoice" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "labourCost" DECIMAL(12,2) NOT NULL,
    "partsTotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceInvoiceItem" (
    "id" SERIAL NOT NULL,
    "serviceInvoiceId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ServiceInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceInvoice_branchId_idx" ON "ServiceInvoice"("branchId");

-- CreateIndex
CREATE INDEX "ServiceInvoice_customerId_idx" ON "ServiceInvoice"("customerId");

-- CreateIndex
CREATE INDEX "ServiceInvoice_createdAt_idx" ON "ServiceInvoice"("createdAt");

-- CreateIndex
CREATE INDEX "ServiceInvoiceItem_serviceInvoiceId_idx" ON "ServiceInvoiceItem"("serviceInvoiceId");

-- AddForeignKey
ALTER TABLE "CustomerLedger" ADD CONSTRAINT "CustomerLedger_serviceInvoiceId_fkey" FOREIGN KEY ("serviceInvoiceId") REFERENCES "ServiceInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceInvoice" ADD CONSTRAINT "ServiceInvoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceInvoice" ADD CONSTRAINT "ServiceInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceInvoiceItem" ADD CONSTRAINT "ServiceInvoiceItem_serviceInvoiceId_fkey" FOREIGN KEY ("serviceInvoiceId") REFERENCES "ServiceInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceInvoiceItem" ADD CONSTRAINT "ServiceInvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
