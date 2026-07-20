import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const page = await prisma.contentPage.findUnique({
    where: { slug: 'parts-fulfillment-branch' },
  });
  const branchId = page?.content
    ? (JSON.parse(page.content) as { branchId?: number }).branchId ?? null
    : null;
  console.log('Fulfillment branchId:', branchId);

  const bikes = await prisma.product.findMany({
    where: { type: 'BIKE', isActive: true },
    select: {
      id: true,
      name: true,
      listingOrder: true,
      branchProducts: {
        where: branchId ? { branchId } : { branchId: -1 },
        select: { isListed: true },
      },
    },
    orderBy: [{ listingOrder: 'asc' }, { createdAt: 'desc' }],
  });

  console.log('\nAll active bikes (catalog):');
  for (const [i, bike] of bikes.entries()) {
    const listed = bike.branchProducts[0]?.isListed ?? false;
    console.log(
      `${i + 1}. listingOrder=${bike.listingOrder} listed=${listed} name=${bike.name}`,
    );
  }

  const visible = bikes.filter((b) => b.branchProducts[0]?.isListed);
  console.log('\nVisible on public shop:');
  for (const [i, bike] of visible.entries()) {
    console.log(
      `  position ${i + 1}: listingOrder=${bike.listingOrder} name=${bike.name}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
