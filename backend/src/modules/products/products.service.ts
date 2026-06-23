import { ProductType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';
import { slugify } from '../../utils/crypto.js';

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
  const where = {
    ...(query.type && { type: query.type }),
    ...(query.brandId && { brandId: query.brandId }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(!query.includeInactive && { isActive: true }),
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { description: { contains: query.search, mode: 'insensitive' as const } },
      ],
    }),
    ...(query.branchId && {
      branchProducts: { some: { branchId: query.branchId, isListed: true } },
    }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      include: {
        brand: true,
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        branchProducts: query.branchId
          ? { where: { branchId: query.branchId, isListed: true } }
          : false,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  const data = query.branchId
    ? products.map((product) => ({
        ...product,
        stockAtBranch: product.branchProducts[0]?.stock ?? 0,
      }))
    : products;

  return paginatedResponse(data, total, page, limit);
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

export async function createProduct(
  data: {
    name: string;
    type: ProductType;
    brandId?: number;
    categoryId?: number;
    price: number;
    salePrice?: number;
    description?: string;
    specs?: object;
    colorOptions?: object;
  },
  linkBranchId?: number
) {
  const slug = slugify(data.name);
  const existing = await prisma.product.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  const product = await prisma.product.create({
    data: {
      name: data.name,
      slug: finalSlug,
      type: data.type,
      brandId: data.brandId,
      categoryId: data.categoryId,
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

  return product;
}

export async function branchOwnsProduct(branchId: number, productId: string) {
  const link = await prisma.branchProduct.findUnique({
    where: { branchId_productId: { branchId, productId } },
  });
  return !!link;
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  return prisma.product.update({
    where: { id },
    data,
    include: { brand: true, category: true, images: true },
  });
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
    stockAtBranch: number;
    unitPrice: number;
    brand?: { name: string } | null;
    images?: { url: string }[];
  }[] = [];

  for (const row of rows) {
    const product = row.product;
    if (!product.isActive) continue;
    if (product.type !== ProductType.BIKE && product.type !== ProductType.PART) continue;

    saleable.push({
      id: product.id,
      name: product.name,
      type: product.type,
      stockAtBranch: row.stock,
      unitPrice: Number(product.salePrice ?? product.price),
      brand: product.brand,
      images: product.images,
    });
  }

  return saleable;
}

/** Branch-selected bikes/parts for purchase invoices (includes zero stock). */
export async function listBranchPurchaseProducts(branchId: number) {
  const rows = await listBranchSelectedProductRows(branchId);

  const purchasable: { id: string; name: string; type: ProductType }[] = [];

  for (const row of rows) {
    const product = row.product;
    if (!product.isActive) continue;
    if (product.type !== ProductType.BIKE && product.type !== ProductType.PART) continue;
    purchasable.push({
      id: product.id,
      name: product.name,
      type: product.type,
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
