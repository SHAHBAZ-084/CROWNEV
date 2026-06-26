-- Simplify service booking statuses to PENDING and SCHEDULED only.

ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";

CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'SCHEDULED');

ALTER TABLE "ServiceBooking" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "ServiceBooking" ALTER COLUMN "status" TYPE "BookingStatus" USING (
  CASE "status"::text
    WHEN 'CONFIRMED' THEN 'SCHEDULED'::"BookingStatus"
    WHEN 'DONE' THEN 'SCHEDULED'::"BookingStatus"
    WHEN 'CANCELLED' THEN 'PENDING'::"BookingStatus"
    WHEN 'PENDING' THEN 'PENDING'::"BookingStatus"
    ELSE 'PENDING'::"BookingStatus"
  END
);

DROP TYPE "BookingStatus_old";

ALTER TABLE "ServiceBooking" ALTER COLUMN "status" SET DEFAULT 'PENDING';
