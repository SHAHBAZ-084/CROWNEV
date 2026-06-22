-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN "number" INTEGER;

-- Backfill: sequential 1, 2, 3… per branch and voucher type (by creation order)
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "branchId", "type"
      ORDER BY "createdAt", id
    ) AS rn
  FROM "Voucher"
)
UPDATE "Voucher" v
SET "number" = n.rn
FROM numbered n
WHERE v.id = n.id;

ALTER TABLE "Voucher" ALTER COLUMN "number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_branchId_type_number_key" ON "Voucher"("branchId", "type", "number");
