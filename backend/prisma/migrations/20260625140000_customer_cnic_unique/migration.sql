-- Global CNIC uniqueness (NULL allowed for online customers without CNIC)
DROP INDEX IF EXISTS "Customer_branchId_cnic_key";

CREATE UNIQUE INDEX "Customer_cnic_key" ON "Customer"("cnic");
