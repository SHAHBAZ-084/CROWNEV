-- Add user-facing invoice date (separate from record createdAt audit timestamp).

ALTER TABLE "Order" ADD COLUMN "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Order" SET "invoiceDate" = "createdAt";
CREATE INDEX "Order_invoiceDate_idx" ON "Order"("invoiceDate");

ALTER TABLE "Purchase" ADD COLUMN "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Purchase" SET "invoiceDate" = "createdAt";
CREATE INDEX "Purchase_invoiceDate_idx" ON "Purchase"("invoiceDate");

ALTER TABLE "ServiceInvoice" ADD COLUMN "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "ServiceInvoice" SET "invoiceDate" = "createdAt";
CREATE INDEX "ServiceInvoice_invoiceDate_idx" ON "ServiceInvoice"("invoiceDate");
