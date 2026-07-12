-- DropForeignKey
ALTER TABLE "Branch" DROP CONSTRAINT IF EXISTS "Branch_ownerId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Branch_ownerId_key";

-- AlterTable
ALTER TABLE "Branch" DROP COLUMN IF EXISTS "ownerId";
