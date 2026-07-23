import { ProductType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { searchBranchCatalog } from '../src/modules/inventory/inventory.service.js';
import { createProduct } from '../src/modules/products/products.service.js';

describe.skipIf(!process.env.DATABASE_URL)('searchBranchCatalog', () => {
  let branchId: number;
  let productId: string;
  const itemCode = `CH-1935-SW-TEST-${Date.now()}`;
  const modelName = `Test Model ${Date.now()}`;

  beforeAll(async () => {
    const branch = await prisma.branch.create({
      data: {
        name: `Catalog Search Test ${Date.now()}`,
        location: 'Test City',
        phone: '03001112233',
        isActive: true,
        showOnPublicSite: false,
      },
    });
    branchId = branch.id;

    const product = await createProduct({
      name: 'Admin-added test switch',
      type: ProductType.PART,
      price: 500,
      description: 'Catalog search regression part',
      specs: {
        item_code: itemCode,
        model: modelName,
        cp_price: 300,
        unit: 'piece',
      },
    });
    productId = product!.id;
  });

  afterAll(async () => {
    if (productId) {
      await prisma.branchProduct.deleteMany({ where: { productId } });
      await prisma.productImage.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    if (branchId) {
      await prisma.branch.deleteMany({ where: { id: branchId } });
    }
    await prisma.$disconnect();
  });

  it('finds admin-created parts by item_code', async () => {
    const rows = await searchBranchCatalog(branchId, itemCode, 10);
    expect(rows.some((row) => row.source === 'PRODUCT' && row.id === productId)).toBe(true);
    const match = rows.find((row) => row.id === productId);
    expect(match?.code).toBe(itemCode);
  });

  it('finds admin-created parts by model name', async () => {
    const rows = await searchBranchCatalog(branchId, modelName, 10);
    expect(rows.some((row) => row.source === 'PRODUCT' && row.id === productId)).toBe(true);
    const match = rows.find((row) => row.id === productId);
    expect(match?.model).toBe(modelName);
  });
});
