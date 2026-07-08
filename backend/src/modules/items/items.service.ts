import { ChassisStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, getPagination, paginatedResponse } from '../../utils/helpers.js';

export async function createItem(data: {
  productId: string;
  color?: string;
  model?: string;
  costPrice: number;
  salePrice: number;
  stockQty?: number;
  isActive?: boolean;
}) {
  // Validate product exists
  const product = await prisma.product.findUnique({
    where: { id: data.productId, isActive: true },
  });
  if (!product) {
    throw new AppError(404, 'Product not found or inactive');
  }

  // Validate color is from colorOptions if product has colorOptions
  if (data.color && product.colorOptions) {
    const options = product.colorOptions as any[];
    const hasColor = options.some((opt) => opt === data.color || (opt && typeof opt === 'object' && opt.name === data.color));
    if (!hasColor) {
      throw new AppError(400, `Selected color variant "${data.color}" is not configured on the product`);
    }
  }

  return prisma.item.create({
    data: {
      productId: data.productId,
      color: data.color || null,
      model: data.model || null,
      costPrice: new Prisma.Decimal(data.costPrice),
      salePrice: new Prisma.Decimal(data.salePrice),
      stockQty: data.stockQty ?? 0,
      isActive: data.isActive !== false,
    },
    include: {
      product: {
        include: {
          brand: true,
          category: true,
        },
      },
    },
  });
}

export async function getItems(query: {
  page?: string;
  limit?: string;
  search?: string;
  brandId?: string;
  categoryId?: string;
  isActive?: string;
}) {
  const { page, limit, skip } = getPagination(query);

  const search = query.search?.trim();
  const brandId = query.brandId ? parseInt(query.brandId, 10) : undefined;
  const categoryId = query.categoryId ? parseInt(query.categoryId, 10) : undefined;
  const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined;

  const where: Prisma.ItemWhereInput = {
    ...(isActive !== undefined && { isActive }),
    product: {
      isActive: true,
      ...(brandId && { brandId }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
  };

  // If search query is a number, we also match against Item Code (id)
  if (search && /^\d+$/.test(search)) {
    const code = parseInt(search, 10);
    where.OR = [
      { id: code },
      { product: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      skip,
      take: limit,
      include: {
        product: {
          include: {
            brand: true,
            category: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    }),
    prisma.item.count({ where }),
  ]);

  return paginatedResponse(items, total, page, limit);
}

export async function getItem(id: number) {
  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          brand: true,
          category: true,
        },
      },
    },
  });
  if (!item) throw new AppError(404, 'Item not found');
  return item;
}

export async function updateItem(
  id: number,
  data: {
    color?: string;
    model?: string;
    costPrice?: number;
    salePrice?: number;
    stockQty?: number;
    isActive?: boolean;
  },
) {
  const item = await getItem(id);

  // Validate color is from colorOptions if changing color
  if (data.color && item.product.colorOptions) {
    const options = item.product.colorOptions as any[];
    const hasColor = options.some((opt) => opt === data.color || (opt && typeof opt === 'object' && opt.name === data.color));
    if (!hasColor) {
      throw new AppError(400, `Selected color variant "${data.color}" is not configured on the product`);
    }
  }

  return prisma.item.update({
    where: { id },
    data: {
      ...(data.color !== undefined && { color: data.color || null }),
      ...(data.model !== undefined && { model: data.model || null }),
      ...(data.costPrice !== undefined && { costPrice: new Prisma.Decimal(data.costPrice) }),
      ...(data.salePrice !== undefined && { salePrice: new Prisma.Decimal(data.salePrice) }),
      ...(data.stockQty !== undefined && { stockQty: data.stockQty }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    include: {
      product: {
        include: {
          brand: true,
          category: true,
        },
      },
    },
  });
}

export async function deleteItem(id: number) {
  return prisma.item.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function getItemChassisNumbers(id: number, branchId: number) {
  await getItem(id); // verify item exists
  return prisma.bikeChassisNumber.findMany({
    where: {
      itemId: id,
      branchId,
      status: ChassisStatus.IN_STOCK,
    },
    select: {
      id: true,
      chassisNumber: true,
      engineNumber: true,
      motorNumber: true,
      productId: true,
      purchaseId: true,
      createdAt: true,
      isUsed: true,
      purchasePrice: true,
      meterReading: true,
      condition: true,
      comments: true,
      status: true,
    },
    orderBy: { chassisNumber: 'asc' },
  });
}
