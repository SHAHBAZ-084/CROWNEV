import { Prisma, ProductType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { countInStockChassis } from '../chassis/chassis.service.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';
import { slugify } from '../../utils/crypto.js';
import {
  encodeModelCompatibility,
  modelCompatibilityFilter,
} from '../../utils/modelCompatibility.js';

const PUBLIC_HIDDEN_SPEC_KEYS = ['cp_price'] as const;

function sanitizePublicSpecs(
  specs: Prisma.JsonValue | Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return null;
  const cleaned = { ...(specs as Record<string, unknown>) };
  for (const key of PUBLIC_HIDDEN_SPEC_KEYS) {
    delete cleaned[key];
  }
  return cleaned;
}

/** Treat listingOrder 0 as unset — explicitly ordered products first, then by createdAt. */
export async function findManyWithListingOrder<T extends Omit<Prisma.ProductFindManyArgs, 'orderBy'>>(
  args: T,
): Promise<Prisma.ProductGetPayload<T>[]> {
  const where = args.where ?? {};
  const orderedWhere: Prisma.ProductWhereInput = { AND: [where, { listingOrder: { gt: 0 } }] };
  const unorderedWhere: Prisma.ProductWhereInput = { AND: [where, { listingOrder: 0 }] };
  const skip = args.skip ?? 0;
  const take = args.take;

  const orderedCount = await prisma.product.count({ where: orderedWhere });
  const results: Prisma.ProductGetPayload<T>[] = [];
  let remaining = take;
  let offset = skip;

  if (offset < orderedCount && (remaining === undefined || remaining > 0)) {
    const ordered = await prisma.product.findMany({
      ...args,
      where: orderedWhere,
      orderBy: [{ listingOrder: 'asc' }, { createdAt: 'desc' }],
      skip: offset,
      take: remaining,
    });
    results.push(...(ordered as Prisma.ProductGetPayload<T>[]));
    if (remaining !== undefined) remaining -= ordered.length;
    offset = 0;
  } else {
    offset -= orderedCount;
  }

  if (remaining === undefined || remaining > 0) {
    const unordered = await prisma.product.findMany({
      ...args,
      where: unorderedWhere,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: remaining,
    });
    results.push(...(unordered as Prisma.ProductGetPayload<T>[]));
  }

  return results;
}

function buildProductListWhere(query: {
  type?: ProductType;
  brandId?: number;
  categoryId?: number;
  search?: string;
  includeInactive?: boolean;
  branchId?: number;
  onSale?: boolean;
}) {
  return {
    ...(query.type && { type: query.type }),
    ...(query.brandId && { brandId: query.brandId }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(!query.includeInactive && { isActive: true }),
    ...(query.onSale && { salePrice: { not: null } }),
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { description: { contains: query.search, mode: 'insensitive' as const } },
        { slug: { contains: query.search, mode: 'insensitive' as const } },
      ],
    }),
    ...(query.branchId && {
      branchProducts: { some: { branchId: query.branchId, isListed: true } },
    }),
  };
}

export async function listProducts(query: {
  page?: string;
  limit?: string;
  type?: ProductType;
  brandId?: number;
  categoryId?: number;
  search?: string;
  activeOnly?: boolean;
  includeInactive?: boolean;
  branchId?: number;
}) {
  const { page, limit, skip } = getPagination(query);
  const where = buildProductListWhere(query);

  const listSelect = {
    id: true,
    name: true,
    slug: true,
    type: true,
    price: true,
    salePrice: true,
    listingOrder: true,
    specs: true,
    isActive: true,
    createdAt: true,
    images: {
      orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
      take: 1,
      select: { id: true, url: true, isPrimary: true, sortOrder: true },
    },
    ...(query.branchId
      ? {
          branchProducts: {
            where: { branchId: query.branchId, isListed: true },
            select: { stock: true },
            take: 1,
          },
        }
      : {}),
  } satisfies Prisma.ProductSelect;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      select: listSelect,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  const data = query.branchId
    ? products.map((product) => ({
        ...product,
        stockAtBranch: product.branchProducts?.[0]?.stock ?? 0,
      }))
    : products;

  return paginatedResponse(data, total, page, limit);
}

/** Public shop listing — minimal fields + one thumbnail per product. */
function shopProductSelect(branchId?: number) {
  return {
    id: true,
    name: true,
    slug: true,
    type: true,
    price: true,
    salePrice: true,
    specs: true,
    colorOptions: true,
    brand: { select: { id: true, name: true, slug: true } },
    category: { select: { id: true, name: true, slug: true } },
    images: {
      orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
      take: 1,
      select: { id: true, url: true, isPrimary: true, sortOrder: true },
    },
    ...(branchId
      ? {
          branchProducts: {
            where: { branchId, isListed: true },
            select: { stock: true },
            take: 1,
          },
        }
      : {}),
  };
}

function mapShopListItem<T extends {
  branchProducts?: { stock: number }[];
  specs?: Prisma.JsonValue | null;
}>(
  product: T,
  branchId?: number,
) {
  const specs = sanitizePublicSpecs(product.specs);
  if (!branchId) return { ...product, specs };
  const { branchProducts, ...rest } = product;
  return {
    ...rest,
    specs,
    stockAtBranch: branchProducts?.[0]?.stock ?? 0,
  };
}

export async function listShopProducts(query: {
  page?: string;
  limit?: string;
  type?: ProductType;
  brandId?: number;
  categoryId?: number;
  search?: string;
  branchId?: number;
  onSale?: boolean;
}) {
  const { page, limit, skip } = getPagination(query);
  const listedAtBranch = {
    branchProducts: {
      some: {
        isListed: true,
        ...(query.branchId !== undefined && { branchId: query.branchId }),
      },
    },
  };
  const where = {
    ...buildProductListWhere({ ...query, includeInactive: false }),
    ...listedAtBranch,
  };
  const select = shopProductSelect(query.branchId);

  if (query.type) {
    const [products, total] = await Promise.all([
      findManyWithListingOrder({ where, skip, take: limit, select }),
      prisma.product.count({ where }),
    ]);
    return paginatedResponse(
      products.map((product) => mapShopListItem(product, query.branchId)),
      total,
      page,
      limit,
    );
  }

  const bikeWhere = { ...where, type: ProductType.BIKE };
  const partWhere = { ...where, type: ProductType.PART };

  const [bikeCount, partCount] = await Promise.all([
    prisma.product.count({ where: bikeWhere }),
    prisma.product.count({ where: partWhere }),
  ]);
  const total = bikeCount + partCount;

  type ShopListProduct = Awaited<
    ReturnType<typeof prisma.product.findMany<{ select: typeof select }>>
  >[number];
  const rows: ShopListProduct[] = [];
  let remaining = limit;
  let offset = skip;

  if (offset < bikeCount && remaining > 0) {
    const bikes = await findManyWithListingOrder({
      where: bikeWhere,
      skip: offset,
      take: Math.min(remaining, bikeCount - offset),
      select,
    });
    rows.push(...bikes);
    remaining -= bikes.length;
    offset = 0;
  } else {
    offset -= bikeCount;
  }

  if (remaining > 0) {
    const parts = await findManyWithListingOrder({
      where: partWhere,
      skip: offset,
      take: remaining,
      select,
    });
    rows.push(...parts);
  }

  return paginatedResponse(
    rows.map((product) => mapShopListItem(product, query.branchId)),
    total,
    page,
    limit,
  );
}

export async function getShopFilters() {
  const [brands, categories] = await Promise.all([
    listBrands(),
    listCategories(),
  ]);
  return { brands, categories };
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      brand: true,
      category: true,
      images: { orderBy: { sortOrder: 'asc' } },
      bikePartDetails: true,
    },
  });
  if (!product) throw new AppError(404, 'Product not found');
  return product;
}

export async function getPublicShopProduct(id: string, branchId: number) {
  const product = await prisma.product.findFirst({
    where: {
      id,
      isActive: true,
      branchProducts: { some: { branchId, isListed: true } },
    },
    include: {
      brand: true,
      category: true,
      images: { orderBy: { sortOrder: 'asc' } },
      bikePartDetails: true,
      branchProducts: { where: { branchId }, select: { stock: true } },
    },
  });
  if (!product) throw new AppError(404, 'Product not found');
  const { branchProducts, ...rest } = product;
  return {
    ...rest,
    specs: sanitizePublicSpecs(rest.specs),
    stockAtBranch: branchProducts[0]?.stock ?? 0,
  };
}

export async function createProduct(
  data: {
    name: string;
    type: ProductType;
    brandId?: number;
    categoryId?: number;
    brandName?: string;
    categoryName?: string;
    model?: string;
    listingOrder?: number;
    price: number;
    salePrice?: number;
    description?: string;
    specs?: object;
    colorOptions?: any;
    compatibleModels?: string[];
  },
  linkBranchId?: number
) {
  const slug = slugify(data.name);
  const existing = await prisma.product.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;
  const brandId = await resolveBrandId(data);
  const categoryId = await resolveCategoryId(data);

  const product = await prisma.product.create({
    data: {
      name: data.name,
      slug: finalSlug,
      type: data.type,
      brandId,
      categoryId,
      model: data.model,
      listingOrder: data.listingOrder ?? 0,
      price: data.price,
      salePrice: data.salePrice,
      description: data.description,
      specs: data.specs,
      colorOptions: data.colorOptions,
    },
    include: { brand: true, category: true, images: true },
  });

  if (linkBranchId) {
    await prisma.branchProduct.create({
      data: { branchId: linkBranchId, productId: product.id, isListed: true },
    });
  }

  if (data.type === ProductType.PART && data.compatibleModels !== undefined) {
    await syncPartModelCompatibility(product.id, data.compatibleModels);
  }

  return prisma.product.findUnique({
    where: { id: product.id },
    include: { brand: true, category: true, images: true, bikePartDetails: true },
  });
}

export async function branchOwnsProduct(branchId: number, productId: string) {
  const link = await prisma.branchProduct.findUnique({
    where: { branchId_productId: { branchId, productId } },
  });
  return !!link;
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  const update: Record<string, unknown> = { ...data };
  const compatibleModels = update.compatibleModels as string[] | undefined;
  delete update.compatibleModels;

  if ('brandName' in data || 'brandId' in data) {
    update.brandId = await resolveBrandId({
      brandId: typeof data.brandId === 'number' ? data.brandId : undefined,
      brandName: typeof data.brandName === 'string' ? data.brandName : undefined,
    });
    delete update.brandName;
  }
  if ('categoryName' in data || 'categoryId' in data) {
    update.categoryId = await resolveCategoryId({
      categoryId: typeof data.categoryId === 'number' ? data.categoryId : undefined,
      categoryName: typeof data.categoryName === 'string' ? data.categoryName : undefined,
    });
    delete update.categoryName;
  }

  const product = await prisma.product.update({
    where: { id },
    data: update,
    include: { brand: true, category: true, images: true, bikePartDetails: true },
  });

  if (compatibleModels !== undefined && product.type === ProductType.PART) {
    await syncPartModelCompatibility(id, compatibleModels);
    return prisma.product.findUnique({
      where: { id },
      include: { brand: true, category: true, images: true, bikePartDetails: true },
    });
  }

  return product;
}

export async function deleteProduct(id: string) {
  return prisma.product.update({ where: { id }, data: { isActive: false } });
}

export async function addProductImage(productId: string, url: string, isPrimary = false, sortOrder = 0) {
  if (isPrimary) {
    await prisma.productImage.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });
  }
  return prisma.productImage.create({
    data: { productId, url, isPrimary, sortOrder },
  });
}

export async function setProductImagePrimary(productId: string, imageId: number) {
  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
  if (!image) throw new AppError(404, 'Image not found');
  await prisma.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
  return prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } });
}

export async function deleteProductImage(productId: string, imageId: number) {
  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
  if (!image) throw new AppError(404, 'Image not found');
  await prisma.productImage.delete({ where: { id: imageId } });
  if (image.isPrimary) {
    const next = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });
    if (next) await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
}

export async function listBranchProducts(branchId: number) {
  const rows = await prisma.branchProduct.findMany({
    where: { branchId },
    include: { product: { include: { images: true, brand: true } } },
  });

  return rows.map((row) => ({
    ...row.product,
    stockAtBranch: row.stock,
    isListedAtBranch: row.isListed,
  }));
}

/** Branch-selected catalog products (isListed) for invoice line pickers. */
async function listBranchSelectedProductRows(branchId: number) {
  return prisma.branchProduct.findMany({
    where: { branchId, isListed: true },
    include: {
      product: {
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          brand: true,
          category: true,
        },
      },
    },
    orderBy: { product: { name: 'asc' } },
  });
}

/** Branch-selected bikes/parts for sale and service invoices (includes zero stock). */
export async function listSaleableBranchProducts(branchId: number) {
  const rows = await listBranchSelectedProductRows(branchId);

  const saleable: {
    id: string;
    name: string;
    type: ProductType;
    model?: string | null;
    stockAtBranch: number;
    unitPrice: number;
    brand?: { name: string } | null;
    category?: { name: string } | null;
    colorOptions?: any;
    images?: { url: string }[];
    specs?: Record<string, unknown> | null;
  }[] = [];

  for (const row of rows) {
    const product = row.product;
    if (!product.isActive) continue;
    if (product.type !== ProductType.BIKE && product.type !== ProductType.PART) continue;

    let stockAtBranch = row.stock;
    if (product.type === ProductType.BIKE) {
      stockAtBranch = await countInStockChassis(branchId, product.id);
    }

    saleable.push({
      id: product.id,
      name: product.name,
      type: product.type,
      model: product.model,
      stockAtBranch,
      unitPrice: Number(product.salePrice ?? product.price),
      brand: product.brand,
      category: product.category,
      colorOptions: product.colorOptions,
      images: product.images,
      specs: product.specs as Record<string, unknown> | null,
    });
  }

  return saleable;
}

/** Branch-selected bikes/parts for purchase invoices (includes zero stock). */
export async function listBranchPurchaseProducts(branchId: number) {
  const rows = await listBranchSelectedProductRows(branchId);

  const purchasable: {
    id: string;
    name: string;
    type: ProductType;
    model?: string | null;
    brand?: { name: string } | null;
    category?: { name: string } | null;
    specs?: Record<string, unknown> | null;
  }[] = [];

  for (const row of rows) {
    const product = row.product;
    if (!product.isActive) continue;
    if (product.type !== ProductType.BIKE && product.type !== ProductType.PART) continue;
    purchasable.push({
      id: product.id,
      name: product.name,
      type: product.type,
      model: product.model,
      brand: product.brand,
      category: product.category,
      specs: product.specs as Record<string, unknown> | null,
    });
  }

  return purchasable;
}

export async function setBranchProduct(branchId: number, productId: string, isListed: boolean) {
  return prisma.branchProduct.upsert({
    where: { branchId_productId: { branchId, productId } },
    create: { branchId, productId, isListed },
    update: { isListed },
  });
}

export async function setBranchProductStock(branchId: number, productId: string, quantity: number) {
  if (quantity < 0) throw new AppError(400, 'Quantity cannot be negative');

  return prisma.branchProduct.upsert({
    where: { branchId_productId: { branchId, productId } },
    create: { branchId, productId, stock: quantity, isListed: true },
    update: { stock: quantity },
  });
}

// Categories & Brands
export async function listBikeModels() {
  return prisma.bikeModel.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

async function findBikeModelByNameInsensitive(name: string, excludeId?: number) {
  return prisma.bikeModel.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId != null ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, name: true },
  });
}

export async function createBikeModel(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(400, 'Model name is required');

  const duplicate = await findBikeModelByNameInsensitive(trimmed);
  if (duplicate) throw new AppError(409, `A bike model named "${duplicate.name}" already exists`);

  return prisma.bikeModel.create({
    data: { name: trimmed },
    select: { id: true, name: true },
  });
}

export async function updateBikeModel(id: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(400, 'Model name is required');

  const existing = await prisma.bikeModel.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) throw new AppError(404, 'Bike model not found');

  const duplicate = await findBikeModelByNameInsensitive(trimmed, id);
  if (duplicate) throw new AppError(409, `A bike model named "${duplicate.name}" already exists`);

  return prisma.bikeModel.update({
    where: { id },
    data: { name: trimmed },
    select: { id: true, name: true },
  });
}

export async function deleteBikeModel(id: number) {
  const existing = await prisma.bikeModel.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) throw new AppError(404, 'Bike model not found');

  const partsCount = await prisma.bikePartDetail.count({
    where: modelCompatibilityFilter(existing.name),
  });
  if (partsCount > 0) {
    throw new AppError(
      409,
      `${partsCount} part${partsCount === 1 ? '' : 's'} ${partsCount === 1 ? 'is' : 'are'} tagged with this model — remove those tags first`,
    );
  }

  await prisma.bikeModel.delete({ where: { id } });
}

async function syncPartModelCompatibility(productId: string, models: string[]) {
  const value = encodeModelCompatibility(models);
  const existing = await prisma.bikePartDetail.findFirst({ where: { productId } });
  if (existing) {
    await prisma.bikePartDetail.update({
      where: { id: existing.id },
      data: { modelCompatibility: value },
    });
    return;
  }
  if (value) {
    await prisma.bikePartDetail.create({
      data: { productId, modelCompatibility: value },
    });
  }
}

export async function findOrCreateBrand(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(400, 'Brand name is required');

  const existing = await prisma.brand.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
    orderBy: { isActive: 'desc' },
  });
  if (existing) {
    if (!existing.isActive) {
      return prisma.brand.update({
        where: { id: existing.id },
        data: { isActive: true, name: trimmed, slug: slugify(trimmed) },
      });
    }
    return existing;
  }

  const slug = slugify(trimmed);
  const bySlug = await prisma.brand.findUnique({ where: { slug } });
  if (bySlug) return bySlug;

  return prisma.brand.create({
    data: { name: trimmed, slug },
  });
}

export async function findOrCreateCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError(400, 'Category name is required');

  const existing = await prisma.productCategory.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
    orderBy: { isActive: 'desc' },
  });
  if (existing) {
    if (!existing.isActive) {
      return prisma.productCategory.update({
        where: { id: existing.id },
        data: { isActive: true, name: trimmed, slug: slugify(trimmed) },
      });
    }
    return existing;
  }

  const slug = slugify(trimmed);
  const bySlug = await prisma.productCategory.findUnique({ where: { slug } });
  if (bySlug) return bySlug;

  return prisma.productCategory.create({
    data: { name: trimmed, slug },
  });
}

async function resolveBrandId(input: {
  brandId?: number;
  brandName?: string;
}): Promise<number | null | undefined> {
  if (input.brandId !== undefined) return input.brandId;
  if (input.brandName === undefined) return undefined;
  const trimmed = input.brandName.trim();
  if (!trimmed) return null;
  return (await findOrCreateBrand(trimmed)).id;
}

async function resolveCategoryId(input: {
  categoryId?: number;
  categoryName?: string;
}): Promise<number | null | undefined> {
  if (input.categoryId !== undefined) return input.categoryId;
  if (input.categoryName === undefined) return undefined;
  const trimmed = input.categoryName.trim();
  if (!trimmed) return null;
  return (await findOrCreateCategory(trimmed)).id;
}

export async function listCategories() {
  return prisma.productCategory.findMany({
    where: { isActive: true },
    include: { children: true },
    orderBy: { name: 'asc' },
  });
}

export async function createCategory(data: { name: string; parentId?: number; imageUrl?: string }) {
  return prisma.productCategory.create({
    data: { name: data.name, slug: slugify(data.name), parentId: data.parentId, imageUrl: data.imageUrl },
  });
}

export async function listBrands() {
  return prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
}

export async function createBrand(data: { name: string; logoUrl?: string }) {
  return prisma.brand.create({
    data: { name: data.name, slug: slugify(data.name), logoUrl: data.logoUrl },
  });
}

export async function updateCategory(id: number, data: Partial<{ name: string; parentId: number; imageUrl: string; isActive: boolean }>) {
  const update: Record<string, unknown> = { ...data };
  if (data.name) update.slug = slugify(data.name);
  return prisma.productCategory.update({ where: { id }, data: update });
}

export async function deleteCategory(id: number) {
  return prisma.productCategory.update({ where: { id }, data: { isActive: false } });
}

export async function updateBrand(id: number, data: Partial<{ name: string; logoUrl: string; isActive: boolean }>) {
  const update: Record<string, unknown> = { ...data };
  if (data.name) update.slug = slugify(data.name);
  return prisma.brand.update({ where: { id }, data: update });
}

export async function deleteBrand(id: number) {
  return prisma.brand.update({ where: { id }, data: { isActive: false } });
}
