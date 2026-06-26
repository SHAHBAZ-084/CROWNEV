-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;

-- Seed known showroom coordinates (branch id 1 and 2 when present)
UPDATE "Branch" SET "latitude" = 29.995378379735364, "longitude" = 73.24281476617726 WHERE "id" = 1;
UPDATE "Branch" SET "latitude" = 29.806159737354488, "longitude" = 72.86909682454248 WHERE "id" = 2;
