-- Renumber pure-numeric chart-of-accounts codes per branch to start at 1.

ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "_renumber_old" INTEGER;

UPDATE "Account"
SET "_renumber_old" = code::integer
WHERE code ~ '^[0-9]+$';

UPDATE "Account"
SET code = 'tmp_' || id::text
WHERE "_renumber_old" IS NOT NULL;

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "branchId"
      ORDER BY "_renumber_old", id
    ) AS new_code
  FROM "Account"
  WHERE "_renumber_old" IS NOT NULL
)
UPDATE "Account" AS a
SET code = o.new_code::text
FROM ordered AS o
WHERE a.id = o.id;

ALTER TABLE "Account" DROP COLUMN "_renumber_old";
