-- Rename cargoTrackingId to biltyTrackingId on Order
ALTER TABLE "Order" RENAME COLUMN "cargoTrackingId" TO "biltyTrackingId";
