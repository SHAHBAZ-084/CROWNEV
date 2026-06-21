import { PrismaClient, Role, ProductType, AccountType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Crown Eve database...');

  const adminPassword = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@crown-eve.com' },
    update: {},
    create: {
      email: 'admin@crown-eve.com',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: Role.ADMIN,
      isVerified: true,
      city: 'Karachi',
    },
  });

  const branch1 = await prisma.branch.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Crown Eve Karachi',
      location: 'Main Boulevard, Karachi',
      phone: '+92 300 1234567',
      whatsapp: '+92 300 1234567',
      description:
        'Our Karachi branch has been serving the Clifton and DHA community since 2022, offering full sales, service, and genuine parts support for every Crown Eve model.',
    },
  });

  const branch2 = await prisma.branch.create({
    data: {
      name: 'Crown Eve Lahore',
      location: 'MM Alam Road, Lahore',
      phone: '+92 321 9876543',
      whatsapp: '+92 321 9876543',
      description:
        'Located in the heart of Lahore, this branch provides test rides, financing guidance, and expert EV maintenance for riders across Punjab.',
    },
  });

  const ownerPassword = await bcrypt.hash('Owner@123', 12);
  const owner = await prisma.user.upsert({
    where: { email: 'owner.karachi@crown-eve.com' },
    update: {},
    create: {
      email: 'owner.karachi@crown-eve.com',
      passwordHash: ownerPassword,
      firstName: 'Ahmed',
      lastName: 'Khan',
      role: Role.BRANCH_OWNER,
      branchId: branch1.id,
      isVerified: true,
      city: 'Karachi',
    },
  });

  await prisma.branch.update({
    where: { id: branch1.id },
    data: { ownerId: owner.id },
  });

  const customerPassword = await bcrypt.hash('Customer@123', 12);
  await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      passwordHash: customerPassword,
      firstName: 'Ali',
      lastName: 'Hassan',
      role: Role.CUSTOMER,
      isVerified: true,
      city: 'Islamabad',
      phone: '+92-333-1112233',
    },
  });

  const brand = await prisma.brand.upsert({
    where: { slug: 'crown-eve' },
    update: {},
    create: { name: 'Crown Eve', slug: 'crown-eve' },
  });

  const category = await prisma.productCategory.upsert({
    where: { slug: 'electric-bikes' },
    update: {},
    create: { name: 'Electric Bikes', slug: 'electric-bikes' },
  });

  const bike = await prisma.product.upsert({
    where: { slug: 'crown-eve-pro-x1' },
    update: {},
    create: {
      name: 'Crown Eve Pro X1',
      slug: 'crown-eve-pro-x1',
      type: ProductType.BIKE,
      brandId: brand.id,
      categoryId: category.id,
      price: 185000,
      salePrice: 175000,
      description: 'Premium electric bike with long range and smart features.',
      specs: {
        motor: '1000W BLDC',
        battery: '60V 32Ah Lithium',
        speed: '45 km/h',
        range: '80 km',
        weight: '68 kg',
        chargingTime: '6 hours',
      },
      colorOptions: ['Matte Black', 'Pearl White', 'Electric Blue'],
    },
  });

  await prisma.productImage.create({
    data: {
      productId: bike.id,
      url: 'https://placehold.co/800x600/B34700/FFFFFF?text=Crown+Eve+Pro+X1',
      isPrimary: true,
      sortOrder: 0,
    },
  });

  const partProduct = await prisma.product.upsert({
    where: { slug: '60v-32ah-battery-pack' },
    update: {},
    create: {
      name: '60V 32Ah Battery Pack',
      slug: '60v-32ah-battery-pack',
      type: ProductType.PART,
      brandId: brand.id,
      price: 52000,
      salePrice: 49000,
      description: 'Replacement lithium battery for Crown Eve electric bikes.',
    },
  });

  const part = await prisma.part.upsert({
    where: { itemCode: 'CE-BAT-60V-32AH' },
    update: {},
    create: {
      itemCode: 'CE-BAT-60V-32AH',
      name: '60V 32Ah Battery Pack',
      description: 'Replacement lithium battery for Crown Eve bikes',
      costPrice: 45000,
      alertAt: 3,
    },
  });

  for (const branch of [branch1, branch2]) {
    await prisma.inventory.upsert({
      where: { branchId_partId: { branchId: branch.id, partId: part.id } },
      update: {},
      create: { branchId: branch.id, partId: part.id, quantity: 10 },
    });

    await prisma.branchProduct.upsert({
      where: { branchId_productId: { branchId: branch.id, productId: bike.id } },
      update: {},
      create: { branchId: branch.id, productId: bike.id, isListed: true },
    });

    await prisma.branchProduct.upsert({
      where: { branchId_productId: { branchId: branch.id, productId: partProduct.id } },
      update: {},
      create: { branchId: branch.id, productId: partProduct.id, isListed: true },
    });
  }

  const accCategory = await prisma.accountCategory.create({
    data: { branchId: branch1.id, name: 'Assets' },
  });

  const cashAccount = await prisma.account.create({
    data: {
      branchId: branch1.id,
      categoryId: accCategory.id,
      name: 'Cash in Hand',
      code: '1001',
      type: AccountType.ASSET,
    },
  });

  await prisma.ledger.create({
    data: { branchId: branch1.id, accountId: cashAccount.id, balance: 0 },
  });

  await prisma.testimonial.create({
    data: {
      customerName: 'Usman Malik',
      content: 'Excellent service and great electric bikes. Highly recommended!',
      rating: 5,
      sortOrder: 0,
      status: 'APPROVED',
      isActive: true,
    },
  });

  for (const [slug, title, content] of [
    ['about', 'About Crown Eve', 'Crown Eve Bikes is Pakistan\'s leading multi-branch EV bike retailer.'],
    ['privacy', 'Privacy Policy', 'We respect your privacy and protect your personal data.'],
    ['terms', 'Terms of Service', 'By using our services you agree to these terms and conditions.'],
  ] as const) {
    await prisma.contentPage.upsert({
      where: { slug },
      update: {},
      create: { slug, title, content },
    });
  }

  console.log('Seed complete.');
  console.log('Admin: admin@crown-eve.com / Admin@123');
  console.log('Branch Owner: owner.karachi@crown-eve.com / Owner@123');
  console.log('Customer: customer@example.com / Customer@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
