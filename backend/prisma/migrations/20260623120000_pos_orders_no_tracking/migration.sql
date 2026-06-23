-- POS walk-in sales do not use public tracking IDs.
ALTER TABLE "Order" ALTER COLUMN "trackingId" DROP NOT NULL;

UPDATE "Order"
SET status = 'DELIVERED', "trackingId" = NULL
WHERE type = 'POS';
