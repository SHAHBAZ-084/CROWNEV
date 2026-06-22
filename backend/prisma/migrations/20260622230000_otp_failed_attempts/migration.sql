-- AlterTable
ALTER TABLE "OtpVerification" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0;
