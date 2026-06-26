-- Checkout flow redesign: new order statuses, shipping method, bilty charges, remove trackingId

CREATE TYPE "ShippingMethod" AS ENUM ('BILTY', 'SELF');

CREATE TYPE "OrderStatus_new" AS ENUM (
  'AWAITING_BILTY_CHARGES',
  'AWAITING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'CONFIRMED',
  'CANCELLED'
);

ALTER TABLE "Order" ADD COLUMN "shippingMethod" "ShippingMethod";
ALTER TABLE "Order" ADD COLUMN "biltyCharges" DECIMAL(12, 2);

ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING (
  CASE "status"::text
    WHEN 'PENDING' THEN 'PAYMENT_SUBMITTED'::"OrderStatus_new"
    WHEN 'CONFIRMED' THEN 'CONFIRMED'::"OrderStatus_new"
    WHEN 'DELIVERED' THEN 'CONFIRMED'::"OrderStatus_new"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"OrderStatus_new"
    ELSE 'PAYMENT_SUBMITTED'::"OrderStatus_new"
  END
);

DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'AWAITING_BILTY_CHARGES';

ALTER TABLE "Order" RENAME COLUMN "biltyTrackingId" TO "biltyId";

DROP INDEX IF EXISTS "Order_trackingId_key";
DROP INDEX IF EXISTS "Order_trackingId_idx";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "trackingId";

-- Legacy online orders without shipping method default to self pickup
UPDATE "Order"
SET "shippingMethod" = 'SELF'
WHERE "type" = 'ONLINE' AND "shippingMethod" IS NULL;
