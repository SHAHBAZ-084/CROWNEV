-- Drop global CNIC unique; enforce per-branch CNIC, supplier phone, and bank account name.
DROP INDEX IF EXISTS "Customer_cnic_key";

CREATE UNIQUE INDEX "Customer_branchId_cnic_key" ON "Customer"("branchId", "cnic");

CREATE UNIQUE INDEX "Supplier_branchId_phone_key" ON "Supplier"("branchId", "phone");

CREATE UNIQUE INDEX "BankAccount_branchId_name_key" ON "BankAccount"("branchId", "name");
