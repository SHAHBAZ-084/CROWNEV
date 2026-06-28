-- Branch.about-page description (editable in admin)
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "description" TEXT;
