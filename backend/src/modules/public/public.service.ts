import { prisma } from '../../config/database.js';

export async function getLandingData() {
  const [testimonials, branches, categories, brands, featuredProducts, stats] = await Promise.all([
    prisma.testimonial.findMany({
      where: { status: 'APPROVED', isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 6,
    }),
    prisma.branch.findMany({
      where: {
        isActive: true,
        NOT: { name: { startsWith: 'Accounting Test' } },
      },
      select: { id: true, name: true, location: true, phone: true, whatsapp: true, description: true },
      orderBy: { name: 'asc' },
    }),
    prisma.productCategory.findMany({
      where: { isActive: true, parentId: null },
      include: { children: true },
      take: 10,
    }),
    prisma.brand.findMany({ where: { isActive: true }, take: 12 }),
    prisma.product.findMany({
      where: { isActive: true },
      include: { images: { where: { isPrimary: true }, take: 1 }, brand: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    Promise.all([
      prisma.branch.count({
        where: { isActive: true, NOT: { name: { startsWith: 'Accounting Test' } } },
      }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count({ where: { status: { in: ['CONFIRMED', 'DELIVERED'] } } }),
    ]),
  ]);

  return {
    testimonials,
    branches,
    categories,
    brands,
    featuredProducts,
    stats: {
      branches: stats[0],
      products: stats[1],
      ordersDelivered: stats[2],
    },
  };
}

export async function getContentPage(slug: string) {
  const page = await prisma.contentPage.findUnique({ where: { slug } });
  if (!page) return null;
  return page;
}

export async function listContentPages() {
  return prisma.contentPage.findMany({
    select: { slug: true, title: true, updatedAt: true },
    orderBy: { slug: 'asc' },
  });
}

export async function upsertContentPage(slug: string, title: string, content: string) {
  return prisma.contentPage.upsert({
    where: { slug },
    create: { slug, title, content },
    update: { title, content },
  });
}
