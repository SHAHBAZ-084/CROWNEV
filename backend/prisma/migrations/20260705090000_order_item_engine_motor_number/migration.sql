-- Sale invoices (OrderItem) need to carry the same engine/motor number that
-- was recorded on the purchase invoice for the specific chassis being sold,
-- so it shows up on the sale invoice PDF and anywhere else chassis is shown.
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "engineNumber" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "motorNumber" TEXT;
