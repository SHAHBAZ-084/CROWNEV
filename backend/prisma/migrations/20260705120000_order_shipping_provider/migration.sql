-- Add shipping/courier provider selected by branch owner when setting bilty charges
ALTER TABLE "Order" ADD COLUMN "shippingProvider" TEXT;
