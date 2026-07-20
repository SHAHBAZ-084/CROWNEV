import { CustomerLedgerType, CustomerType, SupplierLedgerType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { createWalkInCustomer, softDeleteWalkInCustomer } from '../src/modules/orders/orders.service.js';
import { createSupplier, softDeleteSupplier } from '../src/modules/suppliers/suppliers.service.js';
import { AppError } from '../src/utils/helpers.js';

const TEST_CNIC_A = '9990101010101';
const TEST_CNIC_B = '9990202020202';
const TEST_PHONE = '03009998877';

describe.skipIf(!process.env.DATABASE_URL)('branch-scoped entity constraints', () => {
  let branchAId: number;
  let branchBId: number;
  const createdCustomerIds: number[] = [];
  const createdSupplierIds: number[] = [];
  const createdBranchIds: number[] = [];

  beforeAll(async () => {
    const suffix = Date.now();
    const branchA = await prisma.branch.create({
      data: {
        name: `Test Branch A ${suffix}`,
        location: 'Test City',
        phone: '03000000001',
        isActive: true,
        showOnPublicSite: false,
      },
    });
    const branchB = await prisma.branch.create({
      data: {
        name: `Test Branch B ${suffix}`,
        location: 'Test City',
        phone: '03000000002',
        isActive: true,
        showOnPublicSite: false,
      },
    });
    branchAId = branchA.id;
    branchBId = branchB.id;
    createdBranchIds.push(branchAId, branchBId);
  });

  afterAll(async () => {
    for (const customerId of createdCustomerIds) {
      await prisma.customerLedger.deleteMany({ where: { customerId } });
      await prisma.customer.deleteMany({ where: { id: customerId } });
    }
    for (const supplierId of createdSupplierIds) {
      await prisma.supplierLedger.deleteMany({ where: { supplierId } });
      await prisma.supplier.deleteMany({ where: { id: supplierId } });
    }
    for (const branchId of createdBranchIds) {
      await prisma.bankAccount.deleteMany({ where: { branchId } });
      await prisma.branch.deleteMany({ where: { id: branchId } });
    }
    await prisma.$disconnect();
  });

  it('allows the same CNIC in two different branches', async () => {
    const a = await createWalkInCustomer({
      branchId: branchAId,
      name: 'Customer A',
      cnic: TEST_CNIC_A,
    });
    const b = await createWalkInCustomer({
      branchId: branchBId,
      name: 'Customer B',
      cnic: TEST_CNIC_A,
    });
    createdCustomerIds.push(a.id, b.id);
    expect(a.cnic).toBe(TEST_CNIC_A);
    expect(b.cnic).toBe(TEST_CNIC_A);
  });

  it('blocks duplicate CNIC in the same branch', async () => {
    await expect(
      createWalkInCustomer({
        branchId: branchAId,
        name: 'Duplicate CNIC',
        cnic: TEST_CNIC_A,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('blocks deleting a customer with ledger history', async () => {
    const customer = await createWalkInCustomer({
      branchId: branchAId,
      name: 'Ledger Customer',
      cnic: TEST_CNIC_B,
    });
    createdCustomerIds.push(customer.id);

    await prisma.customerLedger.create({
      data: {
        customerId: customer.id,
        type: CustomerLedgerType.DEBIT,
        amount: 1000,
        balance: 1000,
        notes: 'Test sale',
      },
    });

    await expect(softDeleteWalkInCustomer(customer.id, branchAId)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Customer has transaction history and cannot be deleted',
    });
  });

  it('allows delete with no history and CNIC reuse in the same branch', async () => {
    const customer = await createWalkInCustomer({
      branchId: branchAId,
      name: 'Disposable Customer',
      cnic: '9990303030303',
    });
    createdCustomerIds.push(customer.id);

    await softDeleteWalkInCustomer(customer.id, branchAId);

    const replacement = await createWalkInCustomer({
      branchId: branchAId,
      name: 'Replacement Customer',
      cnic: '9990303030303',
    });
    createdCustomerIds.push(replacement.id);
    expect(replacement.cnic).toBe('9990303030303');
  });

  it('blocks deleting a supplier with ledger history', async () => {
    const supplier = await createSupplier({
      branchId: branchAId,
      name: 'Ledger Supplier',
      phone: TEST_PHONE,
    });
    createdSupplierIds.push(supplier.id);

    await prisma.supplierLedger.create({
      data: {
        supplierId: supplier.id,
        type: SupplierLedgerType.CREDIT,
        amount: 500,
        balance: 500,
        notes: 'Test purchase',
      },
    });

    await expect(softDeleteSupplier(supplier.id, branchAId)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Supplier has transaction history and cannot be deleted',
    });
  });

  it('branch purge removes customer with ledger when ledger rows are deleted first (clearBranchData path)', async () => {
    const customer = await createWalkInCustomer({
      branchId: branchBId,
      name: 'Purge Customer',
      cnic: '9990404040404',
    });
    createdCustomerIds.push(customer.id);

    await prisma.customerLedger.create({
      data: {
        customerId: customer.id,
        type: CustomerLedgerType.DEBIT,
        amount: 250,
        balance: 250,
        notes: 'Purge test',
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.customerLedger.deleteMany({ where: { customerId: customer.id } });
      await tx.customer.deleteMany({ where: { id: customer.id } });
    });

    const gone = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(gone).toBeNull();
  });
});

describe('entity guard unit checks', () => {
  it('AppError carries status for delete guard failures', () => {
    const err = new AppError(409, 'Customer has transaction history and cannot be deleted');
    expect(err.statusCode).toBe(409);
  });
});
