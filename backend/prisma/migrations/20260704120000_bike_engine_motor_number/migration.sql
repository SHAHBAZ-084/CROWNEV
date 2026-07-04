-- Every bike unit needs a chassis number plus EITHER an engine number OR a motor number.
ALTER TABLE "BikeChassisNumber" ADD COLUMN IF NOT EXISTS "engineNumber" TEXT;
ALTER TABLE "BikeChassisNumber" ADD COLUMN IF NOT EXISTS "motorNumber" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "BikeChassisNumber_engineNumber_key" ON "BikeChassisNumber"("engineNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "BikeChassisNumber_motorNumber_key" ON "BikeChassisNumber"("motorNumber");
