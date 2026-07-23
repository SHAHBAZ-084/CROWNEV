import { ProductType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { listPartsByModel, getPartsFulfillmentBranch, setPartsFulfillmentBranch } from '../src/modules/public/public.service.js';
import { createProduct } from '../src/modules/products/products.service.js';
import { encodeModelCompatibility } from '../src/utils/modelCompatibility.js';

describe.skipIf(!process.env.DATABASE_URL)('listPartsByModel', () => {
  let branchId: number;
  let previousFulfillmentBranchId: number | null = null;
  const suffix = Date.now();
  const autoModel = `AUTO-MODEL-${suffix}`;
  const manualModel = `MANUAL-MODEL-${suffix}`;
  const unlistedModel = `UNLISTED-MODEL-${suffix}`;

  let autoListedId: string;
  let manualListedId: string;
  let unlistedId: string;
  let manualLinkId: number | undefined;

  beforeAll(async () => {
    const branch = await prisma.branch.create({
      data: {
        name: `Parts By Model Test ${suffix}`,
        location: 'Test',
        phone: '03001234567',
        isActive: true,
        showOnPublicSite: false,
      },
    });
    branchId = branch.id;

    previousFulfillmentBranchId = (await getPartsFulfillmentBranch()).branchId;
    await setPartsFulfillmentBranch(branchId);

    const autoListed = await createProduct({
      name: `Auto-listed part ${suffix}`,
      type: ProductType.PART,
      price: 100,
      specs: { item_code: `AUTO-${suffix}`, model: autoModel },
    });
    autoListedId = autoListed!.id;
    await prisma.branchProduct.create({
      data: { branchId, productId: autoListedId, isListed: true, stock: 0 },
    });

    const manualListed = await createProduct({
      name: `Manual-listed part ${suffix}`,
      type: ProductType.PART,
      price: 200,
      specs: { item_code: `MAN-${suffix}`, model: 'Different model value' },
    });
    manualListedId = manualListed!.id;
    await prisma.branchProduct.create({
      data: { branchId, productId: manualListedId, isListed: true, stock: 0 },
    });
    const manualLink = await prisma.bikePartDetail.create({
      data: {
        productId: manualListedId,
        modelCompatibility: encodeModelCompatibility([manualModel]),
      },
    });
    manualLinkId = manualLink.id;

    const unlisted = await createProduct({
      name: `Unlisted part ${suffix}`,
      type: ProductType.PART,
      price: 300,
      specs: { item_code: `UNL-${suffix}`, model: unlistedModel },
    });
    unlistedId = unlisted!.id;
  });

  afterAll(async () => {
    if (manualLinkId) await prisma.bikePartDetail.deleteMany({ where: { id: manualLinkId } });
    for (const productId of [autoListedId, manualListedId, unlistedId]) {
      if (!productId) continue;
      await prisma.branchProduct.deleteMany({ where: { productId } });
      await prisma.bikePartDetail.deleteMany({ where: { productId } });
      await prisma.productImage.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    if (branchId) await prisma.branch.deleteMany({ where: { id: branchId } });
    await setPartsFulfillmentBranch(previousFulfillmentBranchId);
    await prisma.$disconnect();
  });

  it('includes listed parts that auto-match by model field', async () => {
    const rows = await listPartsByModel(autoModel);
    expect(rows.some((row) => row.id === autoListedId)).toBe(true);
  });

  it('excludes parts not added to branch stock even when model matches', async () => {
    const rows = await listPartsByModel(unlistedModel);
    expect(rows.some((row) => row.id === unlistedId)).toBe(false);
  });

  it('keeps manually linked parts under their linked model', async () => {
    const rows = await listPartsByModel(manualModel);
    expect(rows.some((row) => row.id === manualListedId)).toBe(true);
  });

  it('does not rewrite BikePartDetail rows when auto-matching another model', async () => {
    await listPartsByModel(autoModel);
    const link = await prisma.bikePartDetail.findUnique({ where: { id: manualLinkId! } });
    expect(link?.modelCompatibility).toBe(encodeModelCompatibility([manualModel]));
  });
});
