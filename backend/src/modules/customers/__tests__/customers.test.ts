import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CustomerType, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createApp } from '../../../app.js';
import { signToken } from '../../../utils/crypto.js';
import {
  createWalkInCustomer,
  listWalkInCustomers,
} from '../../orders/orders.service.js';
import { ensureOnlineCustomer } from '../customers.service.js';

const prisma = new PrismaClient();
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let baseUrl = '';
let branchId = 0;
let ownerToken = '';

describe('Unified Customer table', () => {
  beforeAll(async () => {
    const branch = await prisma.branch.findFirst({ where: { isActive: true } });
    if (!branch) throw new Error('No branch in database');

    const owner = await prisma.user.findFirst({
      where: { email: 'owner.karachi@crown-eve.com' },
    });
    if (!owner?.branchId) throw new Error('Branch owner not found');

    branchId = branch.id;
    ownerToken = signToken({
      userId: owner.id,
      email: owner.email,
      role: owner.role,
      branchId: owner.branchId,
    });

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('lists walk-in customers via API without 500', async () => {
    const res = await fetch(`${baseUrl}/walk-in/${branchId}/customers`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('creates a walk-in customer with type WALK_IN', async () => {
    const cnic = `88888${Date.now().toString().slice(-7)}`;
    const created = await createWalkInCustomer({
      branchId,
      name: 'Vitest Walk-In',
      cnic,
      phone: '03009998877',
    });
    expect(created.type).toBe(CustomerType.WALK_IN);
    expect(created.branchId).toBe(branchId);
    expect(typeof created.balance).toBe('number');
  });

  it('creates an online customer linked to User', async () => {
    const email = `vitest.online.${Date.now()}@crown-eve.com`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash('Test@12345', 12),
        firstName: 'Vitest',
        lastName: 'Online',
        role: 'CUSTOMER',
        isVerified: true,
      },
    });

    try {
      const customer = await ensureOnlineCustomer(user);
      expect(customer.type).toBe(CustomerType.ONLINE);
      expect(customer.userId).toBe(user.id);
      expect(customer.branchId).toBeNull();
    } finally {
      await prisma.customer.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  it('service list returns only WALK_IN customers for branch', async () => {
    const result = await listWalkInCustomers(branchId, {});
    expect(result.data.every((c) => c.type === CustomerType.WALK_IN)).toBe(true);
    expect(result.data.every((c) => c.branchId === branchId)).toBe(true);
  });

  it('ensures Suppliers category exists with supplier count', async () => {
    const { listAccountCategories } = await import('../../accounting/accounting.service.js');
    const categories = await listAccountCategories(branchId);
    const suppliersCat = categories.find((c) => c.name.toLowerCase() === 'suppliers');
    expect(suppliersCat).toBeTruthy();
    expect(suppliersCat?.isSuppliersCategory).toBe(true);
  });
});
