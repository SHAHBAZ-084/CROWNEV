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
  branchId?: number;
}) {
  const { page, limit, skip } = getPagination(query);
  const where = {
    ...(query.type && { type: query.type }),
    ...(query.brandId && { brandId: query.brandId }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.activeOnly && { isActive: true }),
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
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  return paginatedResponse(products, total, page, limit);
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
  return prisma.branchProduct.findMany({
    where: { branchId },
    include: { product: { include: { images: true, brand: true } } },
  });
}

export async function setBranchProduct(branchId: number, productId: string, isListed: boolean) {
  return prisma.branchProduct.upsert({
    where: { branchId_productId: { branchId, productId } },
    create: { branchId, productId, isListed },
    update: { isListed },
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
