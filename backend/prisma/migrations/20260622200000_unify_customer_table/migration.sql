-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('ONLINE', 'WALK_IN');

-- Rename ledger type enum
ALTER TYPE "WalkInLedgerType" RENAME TO "CustomerLedgerType";

-- Rename walk-in customer table to unified Customer
ALTER TABLE "WalkInCustomer" RENAME TO "Customer";

-- Add unified customer fields
ALTER TABLE "Customer" ADD COLUMN "type" "CustomerType" NOT NULL DEFAULT 'WALK_IN';
ALTER TABLE "Customer" ADD COLUMN "userId" TEXT;

-- ONLINE customers are global; walk-in remain branch-scoped
ALTER TABLE "Customer" ALTER COLUMN "branchId" DROP NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "cnic" DROP NOT NULL;

-- Link registered users to customer profile
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Customer_type_idx" ON "Customer"("type");

-- Rename ledger table and foreign key column
ALTER TABLE "WalkInCustomerLedger" RENAME TO "CustomerLedger";
ALTER TABLE "CustomerLedger" RENAME COLUMN "walkInCustomerId" TO "customerId";

-- Orders reference unified customer
ALTER TABLE "Order" RENAME COLUMN "walkInCustomerId" TO "customerId";

-- Backfill online customer profiles for existing registered users
INSERT INTO "Customer" ("type", "userId", "name", "email", "phone", "balance", "isActive", "createdAt", "updatedAt")
SELECT
  'ONLINE'::"CustomerType",
  u."id",
  TRIM(u."firstName" || ' ' || u."lastName"),
  u."email",
  u."phone",
  0,
  true,
  u."createdAt",
  u."updatedAt"
FROM "User" u
WHERE u."role" = 'CUSTOMER'
  AND u."isVerified" = true
  AND NOT EXISTS (
    SELECT 1 FROM "Customer" c WHERE c."userId" = u."id"
  );
