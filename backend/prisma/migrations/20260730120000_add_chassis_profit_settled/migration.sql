-- AlterTable
ALTER TABLE "BikeChassisNumber" ADD COLUMN "profitSettledAt" TIMESTAMP(3),
ADD COLUMN "profitSettledById" TEXT;

-- CreateIndex
CREATE INDEX "BikeChassisNumber_profitSettledById_idx" ON "BikeChassisNumber"("profitSettledById");

-- AddForeignKey
ALTER TABLE "BikeChassisNumber" ADD CONSTRAINT "BikeChassisNumber_profitSettledById_fkey" FOREIGN KEY ("profitSettledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
