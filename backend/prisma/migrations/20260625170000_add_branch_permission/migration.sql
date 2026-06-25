-- CreateEnum (idempotent)
DO $$ BEGIN
    CREATE TYPE "BranchPermission" AS ENUM ('WRITE_ONLY', 'WRITE_UPDATE', 'WRITE_UPDATE_DELETE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable (idempotent)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "branchPermission" "BranchPermission" NOT NULL DEFAULT 'WRITE_UPDATE_DELETE';
