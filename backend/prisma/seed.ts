import { PrismaClient, Role, ProductType, AccountType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const seedDir = path.dirname(fileURLToPath(import.meta.url));
const SEED_BIKE_ASSETS = path.join(seedDir, 'seed-assets', 'bikes');
const UPLOAD_PRODUCTS_DIR = path.resolve(process.cwd(), 'uploads', 'products');

type BikeSeed = {
  slug: string;
  name: string;
  price: number;
  salePrice?: number;
  description: string;
  specs: Record<string, string>;
  colorOptions: string[];
  branchStock?: number;
  images?: string[];
};

const LEGACY_SEED_PART_SLUGS = [
  '60v-32ah-battery-pack',
  'bldc-motor-1000w',
  'lcd-display-panel',
  'front-brake-pad-set',
  'tubeless-tyre-16',
  '60v-5a-fast-charger',
  'headlight-assembly-led',
  'rear-shock-absorber',
] as const;

const BIKE_SEEDS: BikeSeed[] = [
  {
    slug: 'crown-eve-pro-x1',
    name: 'Crown Ev Pro X1',
    price: 185000,
    salePrice: 175000,
    description: 'Premium electric bike with long range and smart features for daily commuting.',
    specs: {
      motor_type: 'BLDC Hub Motor',
      motor_watt_min: '800',
      motor_watt_max: '1000',
      battery_voltage: '60V',
      battery_capacity_ah: '32Ah',
      battery_type: 'Lithium-ion',
      speed_min_kmh: '40',
      speed_max_kmh: '45',
      range_eco_min_km: '70',
      range_eco_max_km: '80',
      speed_modes: '3',
      charger: '60V 5A',
      charging_time_min_hrs: '5',
      charging_time_max_hrs: '6',
      net_weight_kg: '68',
      loading_capacity_kg: '150',
      security: 'Key + Alarm',
      braking_system: 'Front & Rear Disc',
      frame_material: 'Steel Step-Through',
      wheel_size: 'Tubeless 16"',
      warranty: '1 Year Battery',
    },
    colorOptions: ['Matte Black', 'Pearl White', 'Electric Blue'],
    branchStock: 6,
    images: ['crown-eve-pro-x1.webp', 'crown-eve-pro-x1-2.webp', 'crown-eve-pro-x1-3.webp'],
  },
  {
    slug: 'crown-eve-city-cruiser',
    name: 'Crown Ev City Cruiser',
    price: 142000,
    salePrice: 135000,
    description: 'Comfort-focused city e-bike with upright riding position and smooth acceleration.',
    specs: {
      motor_type: 'BLDC Hub Motor',
      motor_watt_min: '650',
      motor_watt_max: '800',
      battery_voltage: '60V',
      battery_capacity_ah: '26Ah',
      battery_type: 'Lithium-ion',
      speed_min_kmh: '35',
      speed_max_kmh: '40',
      range_eco_min_km: '58',
      range_eco_max_km: '65',
      speed_modes: '3',
      charger: '60V 4A',
      charging_time_min_hrs: '4',
      charging_time_max_hrs: '5',
      net_weight_kg: '62',
      loading_capacity_kg: '130',
      security: 'Key Start',
      braking_system: 'Front Disc / Rear Drum',
      frame_material: 'Steel Commuter',
      wheel_size: 'Tubeless 16"',
      warranty: '1 Year Battery',
    },
    colorOptions: ['Graphite Grey', 'Forest Green'],
    branchStock: 8,
    images: ['crown-eve-city-cruiser.webp', 'crown-eve-city-cruiser-2.webp'],
  },
  {
    slug: 'crown-eve-delivery-max',
    name: 'Crown Ev Delivery Max',
    price: 198000,
    description: 'Heavy-duty delivery e-bike with extended range and reinforced rear rack.',
    specs: {
      motor_type: 'High-Torque BLDC',
      motor_watt_min: '1000',
      motor_watt_max: '1200',
      battery_voltage: '72V',
      battery_capacity_ah: '35Ah',
      battery_type: 'Lithium-ion',
      speed_min_kmh: '45',
      speed_max_kmh: '50',
      range_eco_min_km: '85',
      range_eco_max_km: '95',
      speed_modes: '3',
      charger: '72V 6A',
      charging_time_min_hrs: '6',
      charging_time_max_hrs: '7',
      net_weight_kg: '74',
      loading_capacity_kg: '200',
      security: 'Key + GPS Ready',
      braking_system: 'Front & Rear Disc CBS',
      frame_material: 'Reinforced Steel Cargo',
      wheel_size: 'Tubeless 17"',
      warranty: '1 Year Battery / 6 Month Motor',
    },
    colorOptions: ['Matte Black', 'Safety Yellow'],
    branchStock: 4,
    images: ['crown-eve-delivery-max.webp', 'crown-eve-delivery-max-2.webp'],
  },
  {
    slug: 'crown-eve-lite-s2',
    name: 'Crown Ev Lite S2',
    price: 118000,
    salePrice: 112000,
    description: 'Lightweight entry model ideal for students and short urban trips.',
    specs: {
      motor_type: 'BLDC Hub Motor',
      motor_watt_min: '500',
      motor_watt_max: '650',
      battery_voltage: '48V',
      battery_capacity_ah: '24Ah',
      battery_type: 'Lithium-ion',
      speed_min_kmh: '30',
      speed_max_kmh: '35',
      range_eco_min_km: '48',
      range_eco_max_km: '55',
      speed_modes: '2',
      charger: '48V 3A',
      charging_time_min_hrs: '3',
      charging_time_max_hrs: '4',
      net_weight_kg: '54',
      loading_capacity_kg: '120',
      security: 'Key Start',
      braking_system: 'Front & Rear Drum',
      frame_material: 'Lightweight Steel',
      wheel_size: 'Tubeless 14"',
      warranty: '1 Year Battery',
    },
    colorOptions: ['Sky Blue', 'Silver', 'White'],
    branchStock: 10,
    images: ['crown-eve-lite-s2.webp', 'crown-eve-lite-s2-2.webp'],
  },
  {
    slug: 'crown-eve-trail-rider',
    name: 'Crown Ev Trail Rider',
    price: 165000,
    description: 'All-terrain e-bike with wider tyres and improved suspension for mixed roads.',
    specs: {
      motor_type: 'BLDC Hub Motor',
      motor_watt_min: '800',
      motor_watt_max: '1000',
      battery_voltage: '60V',
      battery_capacity_ah: '30Ah',
      battery_type: 'Lithium-ion',
      speed_min_kmh: '38',
      speed_max_kmh: '42',
      range_eco_min_km: '62',
      range_eco_max_km: '70',
      speed_modes: '3',
      charger: '60V 5A',
      charging_time_min_hrs: '5',
      charging_time_max_hrs: '6',
      net_weight_kg: '66',
      loading_capacity_kg: '160',
      security: 'Key + Alarm',
      braking_system: 'Front & Rear Disc',
      frame_material: 'Steel Adventure Frame',
      wheel_size: 'Knobby Tubeless 17"',
      warranty: '1 Year Battery',
    },
    colorOptions: ['Army Green', 'Matte Black'],
    branchStock: 5,
  },
];

async function copySeedImages(
  slug: string,
  assetDir: string,
  files: string[],
) {
  await fs.promises.mkdir(UPLOAD_PRODUCTS_DIR, { recursive: true });
  const images: { url: string; isPrimary: boolean; sortOrder: number }[] = [];

  for (let i = 0; i < files.length; i++) {
    const assetPath = path.join(assetDir, files[i]);
    if (!fs.existsSync(assetPath)) {
      throw new Error(`Missing seed image: ${assetPath}`);
    }
    const uploadName = i === 0 ? `seed-${slug}.webp` : `seed-${slug}-${i + 1}.webp`;
    const dest = path.join(UPLOAD_PRODUCTS_DIR, uploadName);
    await fs.promises.copyFile(assetPath, dest);
    images.push({
      url: `/uploads/products/${uploadName}`,
      isPrimary: i === 0,
      sortOrder: i,
    });
  }

  return images;
}

async function syncProductImages(
  productId: string,
  slug: string,
  assetDir: string,
  files: string[],
) {
  const images = await copySeedImages(slug, assetDir, files);
  await prisma.productImage.deleteMany({ where: { productId } });
  for (const img of images) {
    await prisma.productImage.create({
      data: {
        productId,
        url: img.url,
        isPrimary: img.isPrimary,
        sortOrder: img.sortOrder,
      },
    });
  }
}

async function listProductAtBranches(
  productId: string,
  branches: { id: number }[],
  stock = 0,
) {
  for (const branch of branches) {
    await prisma.branchProduct.upsert({
      where: { branchId_productId: { branchId: branch.id, productId } },
      update: { isListed: true, stock },
      create: { branchId: branch.id, productId, isListed: true, stock },
    });
  }
}

async function deactivateLegacySeedParts() {
  for (const slug of LEGACY_SEED_PART_SLUGS) {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: { bikePartDetails: true },
    });
    if (!product) continue;

    await prisma.branchProduct.updateMany({
      where: { productId: product.id },
      data: { isListed: false, stock: 0 },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { isActive: false },
    });

    for (const detail of product.bikePartDetails) {
      await prisma.part.update({
        where: { id: detail.partId },
        data: { isActive: false },
      });
      await prisma.inventory.updateMany({
        where: { partId: detail.partId },
        data: { quantity: 0 },
      });
    }
  }
}

async function main() {
  console.log('Seeding Crown Ev database...');

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
    update: {
      latitude: 29.995425472044637,
      longitude: 73.2428932264022,
    },
    create: {
      name: 'Crown Ev Karachi',
      location: 'Main Boulevard, Karachi',
      phone: '+92 300 1234567',
      whatsapp: '+92 300 1234567',
      latitude: 29.995425472044637,
      longitude: 73.2428932264022,
      description:
        'Our Karachi branch has been serving the Clifton and DHA community since 2022, offering full sales, service, and genuine parts support for every Crown Ev model.',
    },
  });

  const branch2 = await prisma.branch.upsert({
    where: { id: 2 },
    update: {
      latitude: 29.806322679116477,
      longitude: 72.86908609999999,
    },
    create: {
      name: 'Crown Ev Lahore',
      location: 'MM Alam Road, Lahore',
      phone: '+92 321 9876543',
      whatsapp: '+92 321 9876543',
      latitude: 29.806322679116477,
      longitude: 72.86908609999999,
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
    create: { name: 'Crown Ev', slug: 'crown-eve' },
  });

  const category = await prisma.productCategory.upsert({
    where: { slug: 'electric-bikes' },
    update: {},
    create: { name: 'Electric Bikes', slug: 'electric-bikes' },
  });

  await deactivateLegacySeedParts();

  const branches = [branch1, branch2];

  for (const bike of BIKE_SEEDS) {
    const product = await prisma.product.upsert({
      where: { slug: bike.slug },
      update: {
        name: bike.name,
        price: bike.price,
        salePrice: bike.salePrice ?? null,
        description: bike.description,
        specs: bike.specs,
        colorOptions: bike.colorOptions,
        isActive: true,
      },
      create: {
        name: bike.name,
        slug: bike.slug,
        type: ProductType.BIKE,
        brandId: brand.id,
        categoryId: category.id,
        price: bike.price,
        salePrice: bike.salePrice,
        description: bike.description,
        specs: bike.specs,
        colorOptions: bike.colorOptions,
      },
    });

    await syncProductImages(
      product.id,
      bike.slug,
      SEED_BIKE_ASSETS,
      bike.images ?? [`${bike.slug}.webp`],
    );
    await listProductAtBranches(product.id, branches, bike.branchStock ?? 5);
  }

  const existingAccCategory = await prisma.accountCategory.findFirst({
    where: { branchId: branch1.id, name: 'Assets' },
  });
  const accCategory =
    existingAccCategory ??
    (await prisma.accountCategory.create({
      data: { branchId: branch1.id, name: 'Assets' },
    }));

  const existingCash = await prisma.account.findFirst({
    where: { branchId: branch1.id, code: '1' },
  });
  if (!existingCash) {
    const cashAccount = await prisma.account.create({
      data: {
        branchId: branch1.id,
        categoryId: accCategory.id,
        name: 'Cash in Hand',
        code: '1',
        type: AccountType.ASSET,
      },
    });

    await prisma.ledger.create({
      data: { branchId: branch1.id, accountId: cashAccount.id, balance: 0 },
    });
  }

  const testimonialCount = await prisma.testimonial.count();
  if (testimonialCount === 0) {
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
  }

  for (const [slug, title, content] of [
    ['about', 'About Crown Ev', 'Crown Ev Bikes is Pakistan\'s leading multi-branch EV bike retailer.'],
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
  console.log(`Catalog: ${BIKE_SEEDS.length} bikes (listed at both branches). Legacy demo parts deactivated.`);
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
