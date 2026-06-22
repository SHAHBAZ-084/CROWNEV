-- AlterTable
ALTER TABLE "ServiceBooking" ALTER COLUMN "serviceId" DROP NOT NULL;
ALTER TABLE "ServiceBooking" ALTER COLUMN "date" DROP NOT NULL;
ALTER TABLE "ServiceBooking" ALTER COLUMN "time" DROP NOT NULL;
