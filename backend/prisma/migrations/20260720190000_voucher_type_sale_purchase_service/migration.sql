-- Additive only: separate invoice voucher numbering from manual journal vouchers.
ALTER TYPE "VoucherType" ADD VALUE 'SALE';
ALTER TYPE "VoucherType" ADD VALUE 'PURCHASE';
ALTER TYPE "VoucherType" ADD VALUE 'SERVICE';
