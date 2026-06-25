-- Link sold chassis to order line (supports multiple bikes per sale invoice)

ALTER TABLE "BikeChassisNumber" ADD COLUMN "saleOrderItemId" INTEGER;

-- Backfill from legacy saleOrderId + chassisNumber on order line
UPDATE "BikeChassisNumber" bc
SET "saleOrderItemId" = oi.id
FROM "OrderItem" oi
WHERE bc."saleOrderId" = oi."orderId"
  AND bc."chassisNumber" IS NOT NULL
  AND oi."chassisNumber" = bc."chassisNumber";

-- Fallback: match first bike line on the order when chassis text was not copied yet
UPDATE "BikeChassisNumber" bc
SET "saleOrderItemId" = oi.id
FROM "OrderItem" oi
INNER JOIN "Product" p ON p.id = oi."productId"
WHERE bc."saleOrderId" = oi."orderId"
  AND bc."saleOrderItemId" IS NULL
  AND bc."productId" = oi."productId"
  AND p.type = 'BIKE'
  AND oi.id = (
    SELECT MIN(oi2.id)
    FROM "OrderItem" oi2
    WHERE oi2."orderId" = bc."saleOrderId"
      AND oi2."productId" = bc."productId"
  );

DROP INDEX IF EXISTS "BikeChassisNumber_saleOrderId_key";
ALTER TABLE "BikeChassisNumber" DROP CONSTRAINT IF EXISTS "BikeChassisNumber_saleOrderId_fkey";
ALTER TABLE "BikeChassisNumber" DROP COLUMN "saleOrderId";

CREATE UNIQUE INDEX "BikeChassisNumber_saleOrderItemId_key" ON "BikeChassisNumber"("saleOrderItemId");

ALTER TABLE "BikeChassisNumber" ADD CONSTRAINT "BikeChassisNumber_saleOrderItemId_fkey"
  FOREIGN KEY ("saleOrderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
