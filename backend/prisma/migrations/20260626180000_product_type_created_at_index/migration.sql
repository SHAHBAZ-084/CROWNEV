-- Index admin catalog list queries (filter by type, sort by createdAt desc)
CREATE INDEX "Product_type_createdAt_idx" ON "Product"("type", "createdAt" DESC);
